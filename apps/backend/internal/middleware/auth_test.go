package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/pkg/jwt"
)

func newSigner(ttl time.Duration) *jwt.JWT {
	return jwt.New(jwt.JWTConfig{
		SecretKey:     []byte("test-secret"),
		TokenDuration: ttl,
		Issuer:        "test",
	})
}

func setupRouter(signer *jwt.JWT) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/protected", AuthRequired(signer), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user_id": c.GetString(ContextUserID)})
	})
	return r
}

func do(r *gin.Engine, authHeader string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAuthRequired_ValidToken(t *testing.T) {
	signer := newSigner(15 * time.Minute)
	token, err := signer.GenerateToken(map[string]any{"sub": "user-1", "sid": "session-1"})
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	w := do(setupRouter(signer), "Bearer "+token)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "user-1") {
		t.Errorf("expected user id in body, got %s", w.Body.String())
	}
}

func TestAuthRequired_MissingHeader(t *testing.T) {
	signer := newSigner(15 * time.Minute)
	w := do(setupRouter(signer), "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_MalformedHeader(t *testing.T) {
	signer := newSigner(15 * time.Minute)
	w := do(setupRouter(signer), "Token abc.def.ghi")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_InvalidSignature(t *testing.T) {
	signer := newSigner(15 * time.Minute)
	other := jwt.New(jwt.JWTConfig{SecretKey: []byte("different-secret"), TokenDuration: 15 * time.Minute})
	token, _ := other.GenerateToken(map[string]any{"sub": "user-1"})
	w := do(setupRouter(signer), "Bearer "+token)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthRequired_ExpiredToken(t *testing.T) {
	signer := newSigner(15 * time.Minute)
	expiredSigner := newSigner(-time.Hour) // stamps an exp in the past
	token, _ := expiredSigner.GenerateToken(map[string]any{"sub": "user-1"})
	w := do(setupRouter(signer), "Bearer "+token)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "token_expired") {
		t.Errorf("expected token_expired code, got %s", w.Body.String())
	}
}
