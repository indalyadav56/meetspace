package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

func New(cfg ...Config) *zap.Logger {
	var config Config
	if len(cfg) > 0 {
		config = cfg[0]
	}
	level := getLogLevel(config.Level)

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "message",
		StacktraceKey:  "stacktrace",
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
	}

	jsonEncoder := zapcore.NewJSONEncoder(encoderConfig)

	var cores []zapcore.Core

	// stdout core
	stdoutCore := zapcore.NewCore(
		jsonEncoder,
		zapcore.AddSync(os.Stdout),
		level,
	)

	cores = append(cores, stdoutCore)

	// file core
	if config.FileEnabled {
		fileWriter := zapcore.AddSync(&lumberjack.Logger{
			Filename:   config.FilePath,
			MaxSize:    config.MaxSize,
			MaxBackups: config.MaxBackups,
			MaxAge:     config.MaxAge,
			Compress:   config.Compress,
		})

		fileCore := zapcore.NewCore(
			jsonEncoder,
			fileWriter,
			level,
		)

		cores = append(cores, fileCore)
	}

	core := zapcore.NewTee(cores...)

	log := zap.New(
		core,
		zap.AddCaller(),
		zap.AddCallerSkip(1),
		zap.AddStacktrace(zap.ErrorLevel),
	).With(
		zap.String("service", config.Service),
		zap.String("environment", config.Environment),
	)

	return log
}

func getLogLevel(level string) zapcore.Level {
	switch level {
	case "debug":
		return zap.DebugLevel

	case "warn":
		return zap.WarnLevel

	case "error":
		return zap.ErrorLevel

	default:
		return zap.InfoLevel
	}
}
