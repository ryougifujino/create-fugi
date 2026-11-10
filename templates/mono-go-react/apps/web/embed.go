//go:build embed_web

package web

import "embed"

// Dist contains the Vite production build.
//
//go:embed all:dist
var Dist embed.FS
