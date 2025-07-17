package contract

import "fmt"

func IgnoreError(f func() error) {
	if err := f(); err != nil {
		fmt.Printf("Explicitly ignoring and discarding error: %v", err)
	}
}
