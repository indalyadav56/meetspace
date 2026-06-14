package logger

type Config struct {
	Service     string
	Environment string
	Level       string

	FileEnabled bool
	FilePath    string
	MaxSize     int
	MaxBackups  int
	MaxAge      int
	Compress    bool
}
