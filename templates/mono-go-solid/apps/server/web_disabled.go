//go:build !embed_web

package main

import "net/http"

func mountWeb(_ *http.ServeMux) {}
