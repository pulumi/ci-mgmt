package migrations

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConsolidateModules(t *testing.T) {
	tests, err := os.ReadDir("testdata/modules")
	require.NoError(t, err)

	for _, tt := range tests {
		t.Run(tt.Name(), func(t *testing.T) {
			if !tt.IsDir() {
				return
			}

			tmp := t.TempDir()

			// Copy GIVEN to a temp directory so we can mutate it.
			given := filepath.Join("testdata/modules", tt.Name(), "GIVEN")
			err = os.CopyFS(tmp, os.DirFS(given))

			// We need to operate on a git repo, so initialize one.
			out, err := exec.Command("git", "init", tmp).CombinedOutput()
			require.NoError(t, err, string(out))
			out, err = exec.Command("git", "-C", tmp, "add", ".").CombinedOutput()
			require.NoError(t, err, string(out))
			out, err = exec.Command("git", "-C", tmp,
				"-c", "user.name=pulumi-bot", "-c", "user.email=bot@pulumi.com",
				"commit", "-m", "Initial commit").CombinedOutput()
			require.NoError(t, err, string(out))

			// Do the migration.
			m := consolidateModules{}
			err = m.Migrate("", tmp)
			require.NoError(t, err)

			// Make sure we got the expected output.
			want := filepath.Join("testdata/modules", tt.Name(), "WANT")
			assertDirectoryContains(t, want, tmp)
			if !t.Failed() {
				// Check containment in the other direction to establish
				// equality.
				assertDirectoryContains(t, tmp, want)
			}
		})
	}
}

// assertDirectoryContains asserts that dir1 contains all of the files in dir2
// with exactly the same context. The .git directory is ignored.
func assertDirectoryContains(t *testing.T, dir1, dir2 string) {
	t.Helper()

	entries, err := os.ReadDir(dir2)
	require.NoError(t, err)

	for _, entry := range entries {
		if entry.Name() == ".git" {
			continue
		}

		stat, err := os.Stat(filepath.Join(dir1, entry.Name()))
		require.NoError(t, err)
		assert.Equal(t, entry.IsDir(), stat.IsDir())

		subPath1 := filepath.Join(dir1, entry.Name())
		subPath2 := filepath.Join(dir2, entry.Name())

		if entry.IsDir() {
			assertDirectoryContains(t, subPath1, subPath2)
			continue
		}

		content1, err := os.ReadFile(subPath1)
		assert.NoError(t, err)

		content2, err := os.ReadFile(subPath2)
		assert.NoError(t, err)

		assert.Equal(t, string(content1), string(content2), subPath1)
	}
}
