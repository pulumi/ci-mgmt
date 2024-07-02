import argparse
import os
import json


excluded_from_auto_pr =["azure-native"]

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--for-auto-pr', help="only return the providers that should get an automatic PR", action="store_true")
    args = ap.parse_args()

    ps = sorted(os.listdir('../native-provider-ci/providers'))
    if args.for_auto_pr:
        ps = [p for p in ps if p not in excluded_from_auto_pr]

    print(json.dumps(ps))
