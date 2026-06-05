package comparesdk

import "testing"

func TestNormalizeCosmeticDifferences(t *testing.T) {
	tests := []struct {
		name    string
		relPath string
		legacy  string
		gen     string
		wantEq  bool
	}{
		{
			name:    "crlf vs lf is normalized away",
			relPath: "index.ts",
			legacy:  "export const a = 1;\r\nexport const b = 2;\r\n",
			gen:     "export const a = 1;\nexport const b = 2;\n",
			wantEq:  true,
		},
		{
			name:    "trailing whitespace is normalized away",
			relPath: "main.go",
			legacy:  "package main   \nvar x = 1\t\n",
			gen:     "package main\nvar x = 1\n",
			wantEq:  true,
		},
		{
			name:    "trailing blank lines are normalized away",
			relPath: "setup.py",
			legacy:  "x = 1\n\n\n",
			gen:     "x = 1\n",
			wantEq:  true,
		},
		{
			name:    "plugin.json version is normalized away",
			relPath: "pulumi-plugin.json",
			legacy:  "{\n  \"resource\": true,\n  \"version\": \"6.0.0\"\n}\n",
			gen:     "{\n  \"resource\": true,\n  \"version\": \"0.0.0-alpha.0+dev\"\n}\n",
			wantEq:  true,
		},
		{
			name:    "nested plugin.json version is normalized away",
			relPath: "pulumi_aws/pulumi-plugin.json",
			legacy:  "{\"version\": \"6.0.0\"}\n",
			gen:     "{\"version\": \"7.1.2\"}\n",
			wantEq:  true,
		},
		{
			name:    "version outside plugin.json is preserved",
			relPath: "version.txt",
			legacy:  "\"version\": \"6.0.0\"\n",
			gen:     "\"version\": \"7.0.0\"\n",
			wantEq:  false,
		},
		{
			name:    "real content difference survives normalization",
			relPath: "index.ts",
			legacy:  "export const a = 1;\n",
			gen:     "export const a = 2;\n",
			wantEq:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotLegacy := string(Normalize(tt.relPath, []byte(tt.legacy)))
			gotGen := string(Normalize(tt.relPath, []byte(tt.gen)))
			if eq := gotLegacy == gotGen; eq != tt.wantEq {
				t.Fatalf("normalized equality = %v, want %v\nlegacy:\n%q\ngen:\n%q", eq, tt.wantEq, gotLegacy, gotGen)
			}
		})
	}
}
