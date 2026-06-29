package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	emailverifier "github.com/AfterShip/email-verifier"
)

type output struct {
	OK     bool        `json:"ok"`
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

func main() {
	email := flag.String("email", "", "email address to verify")
	smtpEnabled := flag.Bool("smtp", false, "enable SMTP verification without catch-all probing")
	flag.Parse()

	if *email == "" {
		write(output{OK: false, Error: "email is required"})
		os.Exit(2)
	}

	verifier := emailverifier.NewVerifier()
	if *smtpEnabled {
		// Catch-all probing generates random mailbox probes. MarcsMusic policy
		// forbids generated or guessed addresses, so keep it disabled.
		verifier = verifier.EnableSMTPCheck().DisableCatchAllCheck()
	}

	result, err := verifier.Verify(*email)
	if err != nil {
		write(output{OK: false, Error: err.Error()})
		os.Exit(1)
	}

	write(output{OK: true, Result: result})
}

func write(value output) {
	encoder := json.NewEncoder(os.Stdout)
	if err := encoder.Encode(value); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err.Error())
	}
}
