package utils // getFormattedDate returns the current date string in YYYY-MM-DD format.
import "time"

const DateFormat = "2006-01-02"

func GetFormattedDate(t time.Time) string {
	return t.Format(DateFormat)
}
