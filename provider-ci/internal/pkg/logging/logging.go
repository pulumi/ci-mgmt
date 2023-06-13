package logging

import (
	"context"
	"log/slog"
	"os"

	"github.com/lmittmann/tint"
	"github.com/mattn/go-isatty"
)

var LogLevel = new(slog.LevelVar)

// define a unique context key for the logger, must be a struct
type loggerKey struct{}

var loggerContextKey = loggerKey{}

func ContextWithLogger(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerContextKey, logger)
}

func ContextLogWith(ctx context.Context, args ...any) context.Context {
	return ContextWithLogger(ctx, GetLogger(ctx).With(args...))
}

func GetLogger(ctx context.Context) *slog.Logger {
	logger := ctx.Value(loggerContextKey)
	if logger == nil {
		return slog.Default()
	}
	return logger.(*slog.Logger)
}

func NewDefaultLogger() *slog.Logger {
	logW := os.Stderr
	logger := slog.New(
		tint.NewHandler(logW, &tint.Options{
			NoColor: !isatty.IsTerminal(logW.Fd()),
			Level:   LogLevel,
		}),
	)
	slog.SetDefault(logger)

	return logger
}

func SetVerbosity(logger *slog.Logger, verbose int) {
	LogLevel.Set(slog.LevelError)
	switch verbose {
	case 0:
		LogLevel.Set(slog.LevelError)
	case 1:
		LogLevel.Set(slog.LevelWarn)
	case 2:
		LogLevel.Set(slog.LevelInfo)
	case 3:
		LogLevel.Set(slog.LevelDebug)
	default:
		logger.Warn("verbose logging level is outside supported range, defaulting to debug", "verbose", verbose)
		LogLevel.Set(slog.LevelDebug)
	}
}
