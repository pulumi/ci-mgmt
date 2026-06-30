"""Verify a Windows PE binary has an Authenticode signature attached.

Presence check only: parses the PE Optional Header's Certificate Table
directory entry and exits 0 if it is non-empty, non-zero otherwise. Does
not validate the certificate chain or the signature itself; full chain
validation is the verify-release workflow's job.

Purpose: catch the silent-failure pattern in scripts/crossbuild.mk where
the signing block exits 0 without producing a signature (e.g. a future
regression that returns the recipe to /bin/sh and silently skips the
bash conditional).

Usage: python3 scripts/verify_signed.py <path-to-exe>
"""

import struct
import sys


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(
            f"usage: {argv[0]} <path-to-exe>",
            file=sys.stderr,
        )
        return 2
    path = argv[1]
    with open(path, "rb") as f:
        data = f.read()

    # PE header offset is stored at 0x3C.
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    # Optional header Magic: 0x10B = PE32, 0x20B = PE32+.
    magic = struct.unpack_from("<H", data, pe + 24)[0]
    # DataDirectory starts at +96 (PE32) or +112 (PE32+) of optional header.
    # Certificate Table is index 4; each entry is 8 bytes (VirtualAddress, Size).
    dd_start = pe + 24 + (96 if magic == 0x10B else 112)
    cert_size = struct.unpack_from("<I", data, dd_start + 4 * 8 + 4)[0]

    if cert_size == 0:
        print(
            f"ERROR: {path} has no Authenticode signature attached. "
            "The signing step in crossbuild.mk silently failed.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
