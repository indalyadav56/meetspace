// Package opensearch stores search documents in OpenSearch.
package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	os "github.com/opensearch-project/opensearch-go/v4"
	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"

	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
)

type Config struct {
	URLs     []string
	Username string
	Password string
	Index    string
}

type Index struct {
	client *opensearchapi.Client
	name   string
}

// mapping: exact-match fields are keywords; title gets an edge-ngram subfield
// so results appear while the user is still typing.
const mapping = `{
  "settings": {
    "number_of_shards": 1,
    "analysis": {
      "filter": { "prefixes": { "type": "edge_ngram", "min_gram": 2, "max_gram": 20 } },
      "analyzer": {
        "prefix": { "type": "custom", "tokenizer": "standard", "filter": ["lowercase", "asciifolding", "prefixes"] },
        "text": { "type": "custom", "tokenizer": "standard", "filter": ["lowercase", "asciifolding"] }
      }
    }
  },
  "mappings": {
    "properties": {
      "workspace_id": { "type": "keyword" },
      "type": { "type": "keyword" },
      "entity_id": { "type": "keyword" },
      "parent": { "type": "keyword" },
      "key": { "type": "keyword", "normalizer": "lowercase" },
      "audience": { "type": "keyword" },
      "public": { "type": "boolean" },
      "updated_at": { "type": "date" },
      "title": { "type": "text", "analyzer": "text", "fields": { "prefix": { "type": "text", "analyzer": "prefix", "search_analyzer": "text" } } },
      "body": { "type": "text", "analyzer": "text" }
    }
  }
}`

func New(ctx context.Context, cfg Config) (*Index, error) {
	client, err := opensearchapi.NewClient(opensearchapi.Config{Client: os.Config{
		Addresses: cfg.URLs, Username: cfg.Username, Password: cfg.Password,
	}})
	if err != nil {
		return nil, fmt.Errorf("opensearch client: %w", err)
	}
	ix := &Index{client: client, name: cfg.Index}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := ix.ensure(ctx); err != nil {
		return nil, err
	}
	return ix, nil
}

func (ix *Index) ensure(ctx context.Context) error {
	res, err := ix.client.Indices.Exists(ctx, opensearchapi.IndicesExistsReq{Indices: []string{ix.name}})
	if err == nil && res.StatusCode == http.StatusOK {
		return nil
	}
	if res != nil && res.StatusCode != http.StatusNotFound {
		return fmt.Errorf("opensearch: check index: %s", res.Status())
	}
	_, err = ix.client.Indices.Create(ctx, opensearchapi.IndicesCreateReq{Index: ix.name, Body: strings.NewReader(mapping)})
	if err != nil && !strings.Contains(err.Error(), "resource_already_exists") {
		return fmt.Errorf("opensearch: create index %q: %w", ix.name, err)
	}
	return nil
}

func (ix *Index) Ready(ctx context.Context) error {
	_, err := ix.client.Ping(ctx, nil)
	return err
}

func (ix *Index) Upsert(ctx context.Context, docs ...domain.Document) error {
	if len(docs) == 0 {
		return nil
	}
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	for _, d := range docs {
		_ = enc.Encode(map[string]any{"index": map[string]string{"_index": ix.name, "_id": d.ID()}})
		_ = enc.Encode(d)
	}
	res, err := ix.client.Bulk(ctx, opensearchapi.BulkReq{Body: &b})
	if err != nil {
		return fmt.Errorf("opensearch bulk: %w", err)
	}
	if res.Errors {
		for _, item := range res.Items {
			for _, r := range item {
				if r.Error != nil {
					return fmt.Errorf("opensearch bulk: %s: %s", r.Error.Type, r.Error.Reason)
				}
			}
		}
	}
	return nil
}

func (ix *Index) Delete(ctx context.Context, ids ...string) error {
	for _, id := range ids {
		_, err := ix.client.Document.Delete(ctx, opensearchapi.DocumentDeleteReq{Index: ix.name, DocumentID: id})
		if err != nil && !strings.Contains(err.Error(), "not_found") && !strings.Contains(err.Error(), "404") {
			return fmt.Errorf("opensearch delete %s: %w", id, err)
		}
	}
	return nil
}

func (ix *Index) DeleteWorkspace(ctx context.Context, workspaceID string) error {
	body := fmt.Sprintf(`{"query":{"term":{"workspace_id":%q}}}`, workspaceID)
	_, err := ix.client.Document.DeleteByQuery(ctx, opensearchapi.DocumentDeleteByQueryReq{
		Indices: []string{ix.name}, Body: strings.NewReader(body),
		Params: opensearchapi.DocumentDeleteByQueryParams{Refresh: opensearchapi.ToPointer(true)},
	})
	if err != nil {
		return fmt.Errorf("opensearch delete workspace: %w", err)
	}
	return nil
}

func (ix *Index) Search(ctx context.Context, q domain.Query) (*domain.Results, error) {
	// Visible: same workspace, and public or addressed to the user (DMs).
	filter := []any{
		map[string]any{"term": map[string]any{"workspace_id": q.WorkspaceID}},
		map[string]any{"bool": map[string]any{"minimum_should_match": 1, "should": []any{
			map[string]any{"term": map[string]any{"public": true}},
			map[string]any{"term": map[string]any{"audience": q.UserID}},
		}}},
	}
	match := map[string]any{"bool": map[string]any{"minimum_should_match": 1, "should": []any{
		map[string]any{"term": map[string]any{"key": map[string]any{"value": strings.ToLower(q.Text), "boost": 20}}},
		map[string]any{"multi_match": map[string]any{"query": q.Text, "fields": []string{"title^4", "body"}, "fuzziness": "AUTO", "prefix_length": 1}},
		map[string]any{"match": map[string]any{"title.prefix": map[string]any{"query": q.Text, "boost": 2}}},
		map[string]any{"match_phrase": map[string]any{"body": map[string]any{"query": q.Text, "boost": 3}}},
	}}}
	// The type filter is a post_filter so the per-type counts still cover every type.
	body := map[string]any{
		"size":  q.Limit,
		"query": map[string]any{"bool": map[string]any{"filter": filter, "must": []any{match}}},
		"aggs":  map[string]any{"types": map[string]any{"terms": map[string]any{"field": "type", "size": 20}}},
		"highlight": map[string]any{
			"pre_tags": []string{"<mark>"}, "post_tags": []string{"</mark>"}, "encoder": "html",
			"fields": map[string]any{"body": map[string]any{"fragment_size": 140, "number_of_fragments": 1}, "title": map[string]any{"number_of_fragments": 0}},
		},
	}
	if len(q.Types) > 0 {
		body["post_filter"] = map[string]any{"terms": map[string]any{"type": q.Types}}
	}
	if q.Sort == "recent" {
		body["sort"] = []any{map[string]any{"updated_at": "desc"}, "_score"}
	}
	raw, _ := json.Marshal(body)
	res, err := ix.client.Search(ctx, &opensearchapi.SearchReq{Indices: []string{ix.name}, Body: bytes.NewReader(raw)})
	if err != nil {
		return nil, fmt.Errorf("opensearch search: %w", err)
	}
	out := &domain.Results{Total: res.Hits.Total.Value, Hits: make([]domain.Hit, 0, len(res.Hits.Hits)), Counts: map[string]int{}}
	for _, h := range res.Hits.Hits {
		var d domain.Document
		if err := json.Unmarshal(h.Source, &d); err != nil {
			continue
		}
		hit := domain.Hit{Document: d, Score: float64(h.Score)}
		if s := h.Highlight["body"]; len(s) > 0 {
			hit.Snippet = s[0]
		}
		hit.Body = "" // the snippet is enough; don't ship whole documents
		out.Hits = append(out.Hits, hit)
	}
	var aggs struct {
		Types struct {
			Buckets []struct {
				Key   string `json:"key"`
				Count int    `json:"doc_count"`
			} `json:"buckets"`
		} `json:"types"`
	}
	if len(res.Aggregations) > 0 && json.Unmarshal(res.Aggregations, &aggs) == nil {
		for _, b := range aggs.Types.Buckets {
			out.Counts[b.Key] = b.Count
		}
	}
	return out, nil
}
