package mailer

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/mail"
	"strings"
	"testing"
)

func TestBuildIsAValidMultipartMessage(t *testing.T) {
	s, err := New(Config{Host: "smtp.example.com", From: "Meetspace <noreply@example.com>"})
	if err != nil {
		t.Fatal(err)
	}
	to, _ := mail.ParseAddress("ann@example.com")
	raw := s.build(to, Message{Subject: "Héllo ✓", Text: "plain body", HTML: "<p>html body</p>"})

	msg, err := mail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	if subj, _ := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject")); subj != "Héllo ✓" {
		t.Fatalf("subject = %q", subj)
	}
	if !strings.Contains(msg.Header.Get("Message-ID"), "@example.com>") {
		t.Fatalf("message id = %q", msg.Header.Get("Message-ID"))
	}
	_, params, _ := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	r := multipart.NewReader(msg.Body, params["boundary"])
	var bodies []string
	for {
		p, err := r.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(p) // multipart decodes quoted-printable for us
		bodies = append(bodies, p.Header.Get("Content-Type")+"|"+string(b))
	}
	if len(bodies) != 2 || !strings.Contains(bodies[0], "plain body") || !strings.Contains(bodies[1], "<p>html body</p>") {
		t.Fatalf("parts = %q", bodies)
	}
}

func TestNewRejectsBadFrom(t *testing.T) {
	if _, err := New(Config{Host: "h", From: "not an address"}); err == nil {
		t.Fatal("expected an error")
	}
}

// fakeServer speaks just enough SMTP (no TLS, no auth) to accept one message.
func fakeServer(t *testing.T) (port int, got chan string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	got = make(chan string, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		r := bufio.NewReader(conn)
		say := func(s string) { fmt.Fprintf(conn, "%s\r\n", s) }
		say("220 fake ESMTP")
		var envelope, data strings.Builder
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			cmd := strings.ToUpper(strings.TrimSpace(line))
			switch {
			case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
				say("250 fake")
			case strings.HasPrefix(cmd, "MAIL FROM"), strings.HasPrefix(cmd, "RCPT TO"):
				envelope.WriteString(strings.TrimSpace(line) + "\n")
				say("250 ok")
			case cmd == "DATA":
				say("354 go ahead")
				for {
					l, err := r.ReadString('\n')
					if err != nil || l == ".\r\n" {
						break
					}
					data.WriteString(l)
				}
				say("250 queued")
			case cmd == "QUIT":
				say("221 bye")
				got <- envelope.String() + "\n" + data.String()
				return
			default:
				say("250 ok")
			}
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port, got
}

func TestSendSpeaksSMTP(t *testing.T) {
	port, got := fakeServer(t)
	s, err := New(Config{Host: "127.0.0.1", Port: port, From: "Meetspace <noreply@example.com>"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Send(context.Background(), Message{To: "ann@example.com", Subject: "Hi", Text: "hello there"}); err != nil {
		t.Fatal(err)
	}
	out := <-got
	for _, want := range []string{"MAIL FROM:<noreply@example.com>", "RCPT TO:<ann@example.com>", "Subject: Hi", "hello there"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}
