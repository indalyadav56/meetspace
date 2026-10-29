package config

import (
	"bufio"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/logger"
	"github.com/spf13/viper"
)

type Config struct {
	Server     Server     `mapstructure:"server"`
	Postgres   Postgres   `mapstructure:"postgres"`
	Redis      Redis      `mapstructure:"redis"`
	LiveKit    LiveKit    `mapstructure:"livekit"`
	AI         AI         `mapstructure:"ai"`
	Media      Media      `mapstructure:"media"`
	MinIO      MinIO      `mapstructure:"minio"`
	OpenSearch OpenSearch `mapstructure:"opensearch"`
	Web        Web        `mapstructure:"web"`
	Resend     Resend     `mapstructure:"resend"`
	OAuth      OAuth      `mapstructure:"oauth"`
	Inbound    Inbound    `mapstructure:"inbound"`
	Privacy    Privacy    `mapstructure:"privacy"`
	// Integrations configures third-party connections such as GitHub.
	Integrations Integrations  `mapstructure:"integrations"`
	SMTP         SMTP          `mapstructure:"smtp"`
	Logger       logger.Config `mapstructure:"logger"`
	Admin        Admin         `mapstructure:"admin"`
	JWT          JWT           `mapstructure:"jwt"`
	AppEnv       string        `mapstructure:"app_env"`
	Ollama       Ollama        `mapstructure:"ollama"`
	Kafka        Kafka         `mapstructure:"kafka"`
	ClickHouse   ClickHouse    `mapstructure:"clickhouse"`
}

type ClickHouse struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	Database        string        `mapstructure:"database"`
	Secure          bool          `mapstructure:"secure"`
	DialTimeout     time.Duration `mapstructure:"dial_timeout"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

func (c ClickHouse) DSN() string {
	q := url.Values{}
	if c.DialTimeout > 0 {
		q.Set("dial_timeout", c.DialTimeout.String())
	}
	if c.Secure {
		q.Set("secure", "true")
	}
	u := url.URL{
		Scheme:   "clickhouse",
		User:     url.UserPassword(c.User, c.Password),
		Host:     fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:     c.Database,
		RawQuery: q.Encode(),
	}
	return u.String()
}

type Redis struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	Password     string        `mapstructure:"password"`
	DB           int           `mapstructure:"db"`
	DialTimeout  time.Duration `mapstructure:"dial_timeout"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	PoolSize     int           `mapstructure:"pool_size"`
}

// LiveKit points at a self-hosted livekit-server.
type LiveKit struct {
	// URL is the WebSocket URL browsers connect to (ws://localhost:7880).
	URL string `mapstructure:"url"`
	// APIURL is the HTTP URL the backend uses for the room service (http://livekit:7880).
	APIURL    string        `mapstructure:"api_url"`
	APIKey    string        `mapstructure:"api_key"`
	APISecret string        `mapstructure:"api_secret"`
	TokenTTL  time.Duration `mapstructure:"token_ttl"`
}

// AI configures the ADK assistant. It is disabled when GeminiAPIKey is empty.
type AI struct {
	GeminiAPIKey string `mapstructure:"gemini_api_key"`
	Model        string `mapstructure:"model"`
}

type Media struct {
	// Storage is where clip media lives: "minio" (default) or "filesystem" (Dir).
	Storage     string `mapstructure:"storage"`
	Dir         string `mapstructure:"dir"`
	MaxUploadMB int64  `mapstructure:"max_upload_mb"`
}

// OpenSearch powers workspace search. With no URLs, search is disabled.
type OpenSearch struct {
	URLs     []string `mapstructure:"urls"`
	Username string   `mapstructure:"username"`
	Password string   `mapstructure:"password"`
	Index    string   `mapstructure:"index"`
}

// MinIO is the S3-compatible object store for media.
type MinIO struct {
	// Endpoint is host:port without a scheme, e.g. "localhost:9000".
	Endpoint  string `mapstructure:"endpoint"`
	AccessKey string `mapstructure:"access_key"`
	SecretKey string `mapstructure:"secret_key"`
	Bucket    string `mapstructure:"bucket"`
	UseSSL    bool   `mapstructure:"use_ssl"`
	Region    string `mapstructure:"region"`
}

type Web struct {
	// URL is the public web app origin, used for CORS and links.
	URL            string   `mapstructure:"url"`
	AllowedOrigins []string `mapstructure:"allowed_origins"`
}

type Kafka struct {
	Brokers []string `mapstructure:"brokers"`
}

type Ollama struct {
	BaseURL string        `mapstructure:"base_url"`
	Model   string        `mapstructure:"model"`
	Timeout time.Duration `mapstructure:"timeout"`
}

type JWT struct {
	Secret          string        `mapstructure:"secret"`
	Issuer          string        `mapstructure:"issuer"`
	AccessTokenTTL  time.Duration `mapstructure:"access_token_ttl"`
	RefreshTokenTTL time.Duration `mapstructure:"refresh_token_ttl"`
}

type Admin struct {
	Email    string `mapstructure:"email"`
	Password string `mapstructure:"password"`
}

type Server struct {
	Port         string        `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
}

// Integrations holds settings shared by third-party integrations.
type Integrations struct {
	// EncryptionKey encrypts stored access tokens (any long random string).
	EncryptionKey string `mapstructure:"encryption_key"`
}

// Resend sends transactional email (password resets, invites) through the
// Resend API. It takes precedence over SMTP when APIKey is set.
// Privacy holds the grievance officer published on the Privacy Policy.
type Privacy struct {
	GrievanceName    string `mapstructure:"grievance_name"`
	GrievanceEmail   string `mapstructure:"grievance_email"`
	GrievanceAddress string `mapstructure:"grievance_address"`
}

// Inbound configures email-to-task. Point your provider's inbound webhook
// (Postmark, Mailgun, SendGrid…) at /api/v1/inbound/email/<secret>.
type Inbound struct {
	Domain string `mapstructure:"domain"`
	Secret string `mapstructure:"secret"`
}

// OAuth configures single sign-on. Each provider is off until its client id is set.
type OAuth struct {
	GoogleClientID     string `mapstructure:"google_client_id"`
	GoogleClientSecret string `mapstructure:"google_client_secret"`
	// A generic OpenID Connect provider (Okta, Microsoft Entra, Auth0, Keycloak…).
	OIDCName         string `mapstructure:"oidc_name"`
	OIDCIssuer       string `mapstructure:"oidc_issuer"`
	OIDCClientID     string `mapstructure:"oidc_client_id"`
	OIDCClientSecret string `mapstructure:"oidc_client_secret"`
}

type Resend struct {
	APIKey string `mapstructure:"api_key"`
	// From must use a domain verified in Resend; onboarding@resend.dev works
	// for testing but only delivers to the Resend account's own address.
	From string `mapstructure:"from"`
}

// SMTP is an alternative to Resend for any SMTP provider. With neither
// configured, emails are written to the log instead.
type SMTP struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
}

type Postgres struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	Database        string        `mapstructure:"database"`
	SSLMode         string        `mapstructure:"ssl_mode"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `mapstructure:"conn_max_idle_time"`
}

func (c Postgres) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Database, c.SSLMode,
	)
}

func Load() (*Config, error) {
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "dev"
	}

	v := viper.New()
	v.SetConfigType("yaml")
	v.AddConfigPath("configs")
	v.AddConfigPath(".")

	v.SetConfigName(env)
	if err := v.MergeInConfig(); err != nil {
		log.Printf("Info: Could not load %s config: %v", env, err)
	}

	loadDotEnv(".env")

	v.SetEnvPrefix("APP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	for _, key := range v.AllKeys() {
		envKey := "APP_" + strings.ToUpper(strings.ReplaceAll(key, ".", "_"))
		v.BindEnv(key, envKey)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unable to unmarshal config: %w", err)
	}

	cfg.AppEnv = env
	return &cfg, nil
}

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		key, val, ok := parseDotEnvLine(scanner.Text())
		if !ok {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, val)
		}
	}
	_ = scanner.Err()
}

func parseDotEnvLine(raw string) (string, string, bool) {
	line := strings.TrimSpace(raw)
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}
	line = strings.TrimPrefix(line, "export ")

	key, val, ok := strings.Cut(line, "=")
	if !ok {
		return "", "", false
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", "", false
	}
	val = strings.TrimSpace(val)
	if len(val) >= 2 {
		if c := val[0]; (c == '"' || c == '\'') && val[len(val)-1] == c {
			val = val[1 : len(val)-1]
		}
	}
	return key, val, true
}
