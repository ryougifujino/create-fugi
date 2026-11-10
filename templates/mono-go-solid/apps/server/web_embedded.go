//go:build embed_web

package main

import (
	"io/fs"
	"net/http"

	"example.com/app/apps/web"
)

func mountWeb(mux *http.ServeMux) {
	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		panic(err)
	}

	// Keep the web method filter separate from the API subtree.
	pages := http.NewServeMux()
	pages.Handle("GET /", http.FileServerFS(dist))
	mux.Handle("/", pages)
}
