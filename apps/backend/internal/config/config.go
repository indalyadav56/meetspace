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
	Server     Server        `mapstructure:"server"`
	Postgres   Postgres      `mapstructure:"postgres"`
	Logger     logger.Config `mapstructure:"logger"`
	Admin      Admin         `mapstructure:"admin"`
	JWT        JWT           `mapstructure:"jwt"`
	AppEnv     string        `mapstructure:"app_env"`
	Ollama     Ollama        `mapstructure:"ollama"`
	Kafka      Kafka         `mapstructure:"kafka"`
	ClickHouse ClickHouse    `mapstructure:"clickhouse"`
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
