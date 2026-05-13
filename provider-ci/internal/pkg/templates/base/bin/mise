#!/usr/bin/env bash
set -eu

__mise_bootstrap() {
    local cache_home="${XDG_CACHE_HOME:-$HOME/.cache}/mise"
    export MISE_INSTALL_PATH="$cache_home/mise-2026.3.9"
    install() {
        local initial_working_dir="$PWD"
        #!/bin/sh
        set -eu

        #region logging setup
        if [ "${MISE_DEBUG-}" = "true" ] || [ "${MISE_DEBUG-}" = "1" ]; then
          debug() {
            echo "$@" >&2
          }
        else
          debug() {
            :
          }
        fi

        if [ "${MISE_QUIET-}" = "1" ] || [ "${MISE_QUIET-}" = "true" ]; then
          info() {
            :
          }
        else
          info() {
            echo "$@" >&2
          }
        fi

        error() {
          echo "$@" >&2
          exit 1
        }
        #endregion

        #region environment setup
        get_os() {
          os="$(uname -s)"
          if [ "$os" = Darwin ]; then
            echo "macos"
          elif [ "$os" = Linux ]; then
            echo "linux"
          else
            error "unsupported OS: $os"
          fi
        }

        get_arch() {
          musl=""
          if type ldd >/dev/null 2>/dev/null; then
            if [ "${MISE_INSTALL_MUSL-}" = "1" ] || [ "${MISE_INSTALL_MUSL-}" = "true" ]; then
              musl="-musl"
            elif [ "$(uname -o)" = "Android" ]; then
              # Android (Termux) always uses musl
              musl="-musl"
            else
              libc=$(ldd /bin/ls | grep 'musl' | head -1 | cut -d ' ' -f1)
              if [ -n "$libc" ]; then
                musl="-musl"
              fi
            fi
          fi
          arch="$(uname -m)"
          if [ "$arch" = x86_64 ]; then
            echo "x64$musl"
          elif [ "$arch" = aarch64 ] || [ "$arch" = arm64 ]; then
            echo "arm64$musl"
          elif [ "$arch" = armv7l ]; then
            echo "armv7$musl"
          else
            error "unsupported architecture: $arch"
          fi
        }

        get_ext() {
          if [ -n "${MISE_INSTALL_EXT:-}" ]; then
            echo "$MISE_INSTALL_EXT"
          elif [ -n "${MISE_VERSION:-}" ] && echo "$MISE_VERSION" | grep -q '^v2024'; then
            # 2024 versions don't have zstd tarballs
            echo "tar.gz"
          elif tar_supports_zstd; then
            echo "tar.zst"
          else
            echo "tar.gz"
          fi
        }

        tar_supports_zstd() {
          if ! command -v zstd >/dev/null 2>&1; then
            false
          # tar is bsdtar
          elif tar --version | grep -q 'bsdtar'; then
            true
          # tar version is >= 1.31
          elif tar --version | grep -q '1\.\(3[1-9]\|[4-9][0-9]\)'; then
            true
          else
            false
          fi
        }

        shasum_bin() {
          if command -v shasum >/dev/null 2>&1; then
            echo "shasum"
          elif command -v sha256sum >/dev/null 2>&1; then
            echo "sha256sum"
          else
            error "mise install requires shasum or sha256sum but neither is installed. Aborting."
          fi
        }

        get_checksum() {
          version=$1
          os=$2
          arch=$3
          ext=$4
          url="https://github.com/jdx/mise/releases/download/v${version}/SHASUMS256.txt"

          # For current version use static checksum otherwise
          # use checksum from releases
          if [ "$version" = "v2026.3.9" ]; then
            checksum_linux_x86_64="941d8f0ddb25755b471b8245e847efcaf3d985d78ec24f2858a4316691a0b2bf  ./mise-v2026.3.9-linux-x64.tar.gz"
            checksum_linux_x86_64_musl="dd701f49ef6b29b00b219c7870d91ba894ef401d49ba2863e6931b2318d49c2d  ./mise-v2026.3.9-linux-x64-musl.tar.gz"
            checksum_linux_arm64="6e8acf03a3b749c75adbf3799fe94214707257c1fac1f63eb1f696d0d3ce27fd  ./mise-v2026.3.9-linux-arm64.tar.gz"
            checksum_linux_arm64_musl="669d552aeada350aeb4ea89da2256c4103b6ac731580ec09414b4ec7ef7d4497  ./mise-v2026.3.9-linux-arm64-musl.tar.gz"
            checksum_linux_armv7="36b97e9e081034f6a29e68d54fe41fd9e8a5ac731a3c5a1877f18a82ae93fe71  ./mise-v2026.3.9-linux-armv7.tar.gz"
            checksum_linux_armv7_musl="61ac19ae790b7ebb5be6456037cd509f9778807b892a25657e6dd68296f8dece  ./mise-v2026.3.9-linux-armv7-musl.tar.gz"
            checksum_macos_x86_64="a7cf136155077e7590a6748559377a647d472480fd511810a5f00fb3b91872e5  ./mise-v2026.3.9-macos-x64.tar.gz"
            checksum_macos_arm64="a371ecbad19cda70ab196b8672b7c2161f2f958e1bba8b53cb4d378163a72b37  ./mise-v2026.3.9-macos-arm64.tar.gz"
            checksum_linux_x86_64_zstd="345801a6cab539dc1f7692a96bf51fea2404b2246fdecbada26656077a5e82b9  ./mise-v2026.3.9-linux-x64.tar.zst"
            checksum_linux_x86_64_musl_zstd="754c2404d27f51f14441adc422a23065e44ef8de4ed2f89d4ef3db146341f94f  ./mise-v2026.3.9-linux-x64-musl.tar.zst"
            checksum_linux_arm64_zstd="414ab90cbc55b4e2dc71eb30bcbd68c12847f4cae7841eedd54986ff1a177128  ./mise-v2026.3.9-linux-arm64.tar.zst"
            checksum_linux_arm64_musl_zstd="e9d0edd2ac3831e956225cd3d8a8a35c65221af39408c17695642ed7dd1982ec  ./mise-v2026.3.9-linux-arm64-musl.tar.zst"
            checksum_linux_armv7_zstd="a8e3fc87f04d55523158f0fc28350708fa2c4d0e3e8831e3e147ffdedd9d03d2  ./mise-v2026.3.9-linux-armv7.tar.zst"
            checksum_linux_armv7_musl_zstd="2cd3503508796876293f08eefcb97ba1589c0a870afebbce69959b1d8132b69e  ./mise-v2026.3.9-linux-armv7-musl.tar.zst"
            checksum_macos_x86_64_zstd="354de1b53c05f3e225a55495b940d963e7bc7557796288f5e07f53181dd6a791  ./mise-v2026.3.9-macos-x64.tar.zst"
            checksum_macos_arm64_zstd="076187947c67a370f06c80167a7b443cfd4c2f38ac64e69dffe742b7e57b51bf  ./mise-v2026.3.9-macos-arm64.tar.zst"

            # TODO: refactor this, it's a bit messy
            if [ "$ext" = "tar.zst" ]; then
              if [ "$os" = "linux" ]; then
                if [ "$arch" = "x64" ]; then
                  echo "$checksum_linux_x86_64_zstd"
                elif [ "$arch" = "x64-musl" ]; then
                  echo "$checksum_linux_x86_64_musl_zstd"
                elif [ "$arch" = "arm64" ]; then
                  echo "$checksum_linux_arm64_zstd"
                elif [ "$arch" = "arm64-musl" ]; then
                  echo "$checksum_linux_arm64_musl_zstd"
                elif [ "$arch" = "armv7" ]; then
                  echo "$checksum_linux_armv7_zstd"
                elif [ "$arch" = "armv7-musl" ]; then
                  echo "$checksum_linux_armv7_musl_zstd"
                else
                  warn "no checksum for $os-$arch"
                fi
              elif [ "$os" = "macos" ]; then
                if [ "$arch" = "x64" ]; then
                  echo "$checksum_macos_x86_64_zstd"
                elif [ "$arch" = "arm64" ]; then
                  echo "$checksum_macos_arm64_zstd"
                else
                  warn "no checksum for $os-$arch"
                fi
              else
                warn "no checksum for $os-$arch"
              fi
            else
              if [ "$os" = "linux" ]; then
                if [ "$arch" = "x64" ]; then
                  echo "$checksum_linux_x86_64"
                elif [ "$arch" = "x64-musl" ]; then
                  echo "$checksum_linux_x86_64_musl"
                elif [ "$arch" = "arm64" ]; then
                  echo "$checksum_linux_arm64"
                elif [ "$arch" = "arm64-musl" ]; then
                  echo "$checksum_linux_arm64_musl"
                elif [ "$arch" = "armv7" ]; then
                  echo "$checksum_linux_armv7"
                elif [ "$arch" = "armv7-musl" ]; then
                  echo "$checksum_linux_armv7_musl"
                else
                  warn "no checksum for $os-$arch"
                fi
              elif [ "$os" = "macos" ]; then
                if [ "$arch" = "x64" ]; then
                  echo "$checksum_macos_x86_64"
                elif [ "$arch" = "arm64" ]; then
                  echo "$checksum_macos_arm64"
                else
                  warn "no checksum for $os-$arch"
                fi
              else
                warn "no checksum for $os-$arch"
              fi
            fi
          else
            if command -v curl >/dev/null 2>&1; then
              debug ">" curl -fsSL "$url"
              checksums="$(curl --compressed -fsSL "$url")"
            else
              if command -v wget >/dev/null 2>&1; then
                debug ">" wget -qO - "$url"
                checksums="$(wget -qO - "$url")"
              else
                error "mise standalone install specific version requires curl or wget but neither is installed. Aborting."
              fi
            fi
            # TODO: verify with minisign or gpg if available

            checksum="$(echo "$checksums" | grep "$os-$arch.$ext")"
            if ! echo "$checksum" | grep -Eq "^([0-9a-f]{32}|[0-9a-f]{64})"; then
              warn "no checksum for mise $version and $os-$arch"
            else
              echo "$checksum"
            fi
          fi
        }

        #endregion

        download_file() {
          url="$1"
          download_dir="$2"
          filename="$(basename "$url")"
          file="$download_dir/$filename"

          info "mise: installing mise..."

          if command -v curl >/dev/null 2>&1; then
            debug ">" curl -#fLo "$file" "$url"
            curl -#fLo "$file" "$url"
          else
            if command -v wget >/dev/null 2>&1; then
              debug ">" wget -qO "$file" "$url"
              stderr=$(mktemp)
              wget -O "$file" "$url" >"$stderr" 2>&1 || error "wget failed: $(cat "$stderr")"
              rm "$stderr"
            else
              error "mise standalone install requires curl or wget but neither is installed. Aborting."
            fi
          fi

          echo "$file"
        }

        install_mise() {
          version="${MISE_VERSION:-v2026.3.9}"
          version="${version#v}"
          os="${MISE_INSTALL_OS:-$(get_os)}"
          arch="${MISE_INSTALL_ARCH:-$(get_arch)}"
          ext="${MISE_INSTALL_EXT:-$(get_ext)}"
          install_path="${MISE_INSTALL_PATH:-$HOME/.local/bin/mise}"
          install_dir="$(dirname "$install_path")"
          install_from_github="${MISE_INSTALL_FROM_GITHUB:-}"
          if [ "$version" != "v2026.3.9" ] || [ "$install_from_github" = "1" ] || [ "$install_from_github" = "true" ]; then
            tarball_url="https://github.com/jdx/mise/releases/download/v${version}/mise-v${version}-${os}-${arch}.${ext}"
          elif [ -n "${MISE_TARBALL_URL-}" ]; then
            tarball_url="$MISE_TARBALL_URL"
          else
            tarball_url="https://mise.jdx.dev/v${version}/mise-v${version}-${os}-${arch}.${ext}"
          fi

          download_dir="$(mktemp -d)"
          cache_file=$(download_file "$tarball_url" "$download_dir")
          debug "mise-setup: tarball=$cache_file"

          debug "validating checksum"
          cd "$(dirname "$cache_file")" && get_checksum "$version" "$os" "$arch" "$ext" | "$(shasum_bin)" -c >/dev/null

          # extract tarball
          if [ -d "$install_path" ]; then
            error "MISE_INSTALL_PATH '$install_path' is a directory. Please set it to a file path, e.g. '$install_path/mise'."
          fi
          mkdir -p "$install_dir"
          rm -f "$install_path"
          extract_dir="$(mktemp -d)"
          cd "$extract_dir"
          if [ "$ext" = "tar.zst" ] && ! tar_supports_zstd; then
            zstd -d -c "$cache_file" | tar -xf -
          else
            tar -xf "$cache_file"
          fi
          mv mise/bin/mise "$install_path"

          # cleanup
          cd / # Move out of $extract_dir before removing it
          rm -rf "$download_dir"
          rm -rf "$extract_dir"

          info "mise: installed successfully to $install_path"
        }

        after_finish_help() {
          case "${SHELL:-}" in
          */zsh)
            info "mise: run the following to activate mise in your shell:"
            info "echo \"eval \\\"\\\$($install_path activate zsh)\\\"\" >> \"${ZDOTDIR-$HOME}/.zshrc\""
            info ""
            info "mise: run \`mise doctor\` to verify this is set up correctly"
            ;;
          */bash)
            info "mise: run the following to activate mise in your shell:"
            info "echo \"eval \\\"\\\$($install_path activate bash)\\\"\" >> ~/.bashrc"
            info ""
            info "mise: run \`mise doctor\` to verify this is set up correctly"
            ;;
          */fish)
            info "mise: run the following to activate mise in your shell:"
            info "echo \"$install_path activate fish | source\" >> ~/.config/fish/config.fish"
            info ""
            info "mise: run \`mise doctor\` to verify this is set up correctly"
            ;;
          *)
            info "mise: run \`$install_path --help\` to get started"
            ;;
          esac
        }

        install_mise
        if [ "${MISE_INSTALL_HELP-}" != 0 ]; then
          after_finish_help
        fi

        cd -- "$initial_working_dir"
    }
    local MISE_INSTALL_HELP=0
    test -f "$MISE_INSTALL_PATH" || install
}
__mise_bootstrap
exec "$MISE_INSTALL_PATH" "$@"
