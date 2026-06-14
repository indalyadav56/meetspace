package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidSigningMethod = errors.New("invalid signing method")
	ErrInvalidTokenOrClaims = errors.New("invalid token or claims")
)

type JWT struct {
	config JWTConfig
}

func New(config JWTConfig) *JWT {
	return &JWT{
		config: config,
	}
}

// GenerateToken generates a new JWT token with customizable claims. The standard
// registered claims (iat, exp, jti, and iss when an issuer is configured) are
// stamped automatically; jti/iss are only set when the caller hasn't supplied them.
func (j *JWT) GenerateToken(claims map[string]interface{}) (string, error) {
	jwtClaims := jwt.MapClaims(claims)

	now := time.Now()
	jwtClaims["iat"] = now.Unix()
	jwtClaims["exp"] = now.Add(j.config.TokenDuration).Unix()

	if _, ok := jwtClaims["jti"]; !ok {
		jwtClaims["jti"] = uuid.NewString()
	}
	if j.config.Issuer != "" {
		if _, ok := jwtClaims["iss"]; !ok {
			jwtClaims["iss"] = j.config.Issuer
		}
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims)
	return token.SignedString(j.config.SecretKey)
}

// GenerateTokenWithoutExpiration generates a new JWT token without an expiration time
func (j *JWT) GenerateTokenWithoutExpiration(claims map[string]interface{}) (string, error) {
	jwtClaims := jwt.MapClaims(claims)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims)
	return token.SignedString(j.config.SecretKey)
}

// ValidateToken validates the given token string
func (j *JWT) ValidateToken(tokenString string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidSigningMethod
		}
		return j.config.SecretKey, nil
	})
}

// GetClaims extracts the claims from a valid token
func (j *JWT) GetClaims(token *jwt.Token) (map[string]interface{}, error) {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidTokenOrClaims
	}
	return claims, nil
}
