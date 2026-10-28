// Package ical writes iCalendar (RFC 5545) feeds that calendar apps can subscribe to.
package ical

import (
	"strings"
	"time"
	"unicode/utf8"
)

// Event is one VEVENT. AllDay events use Start and End as dates (End exclusive).
type Event struct {
	UID         string
	Summary     string
	Description string
	URL         string
	Start, End  time.Time
	AllDay      bool
	Updated     time.Time
}

// Calendar renders a VCALENDAR with the given name and events.
func Calendar(name string, events []Event, now time.Time) string {
	var b strings.Builder
	line := func(s string) { b.WriteString(fold(s)); b.WriteString("\r\n") }
	line("BEGIN:VCALENDAR")
	line("VERSION:2.0")
	line("PRODID:-//Meetspace//Calendar feed//EN")
	line("CALSCALE:GREGORIAN")
	line("METHOD:PUBLISH")
	line("X-WR-CALNAME:" + Escape(name))
	line("X-PUBLISHED-TTL:PT1H")
	line("REFRESH-INTERVAL;VALUE=DURATION:PT1H")
	for _, e := range events {
		line("BEGIN:VEVENT")
		line("UID:" + e.UID)
		stamp := e.Updated
		if stamp.IsZero() {
			stamp = now
		}
		line("DTSTAMP:" + stamp.UTC().Format("20060102T150405Z"))
		if e.AllDay {
			line("DTSTART;VALUE=DATE:" + e.Start.Format("20060102"))
			line("DTEND;VALUE=DATE:" + e.End.Format("20060102"))
			line("TRANSP:TRANSPARENT")
		} else {
			line("DTSTART:" + e.Start.UTC().Format("20060102T150405Z"))
			line("DTEND:" + e.End.UTC().Format("20060102T150405Z"))
		}
		line("SUMMARY:" + Escape(e.Summary))
		if e.Description != "" {
			line("DESCRIPTION:" + Escape(e.Description))
		}
		if e.URL != "" {
			line("URL:" + e.URL)
		}
		line("END:VEVENT")
	}
	line("END:VCALENDAR")
	return b.String()
}

// Escape quotes text values: backslash, semicolon, comma and newlines.
func Escape(s string) string {
	return strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\r\n", `\n`, "\n", `\n`, "\r", `\n`).Replace(s)
}

// fold splits a content line into 75-octet pieces without breaking a UTF-8 character.
func fold(s string) string {
	if len(s) <= 75 {
		return s
	}
	var b strings.Builder
	limit := 75
	for len(s) > limit {
		cut := limit
		for cut > 0 && !utf8.RuneStart(s[cut]) {
			cut--
		}
		b.WriteString(s[:cut])
		b.WriteString("\r\n ")
		s = s[cut:]
		limit = 74 // the leading space counts toward the next line
	}
	b.WriteString(s)
	return b.String()
}
