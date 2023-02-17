import argparse
import os
import json


def team(provider):
    with open(f"../provider-ci/providers/{provider}/config.yaml", "r") as fp:
        lines = fp.readlines()
    for line in lines:
        if line.startswith("team:"):
            return line[len("team:"):].strip()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--team', help="maintainer team such as 'providers' or 'ecosystem'")
    args = ap.parse_args()


    ps = sorted(os.listdir('../provider-ci/providers'))

    for p in ps:
        if not team(p):
            raise Exception(f"Provider {p} is lacking team: assignment in config.yaml")

    if args.team:
        ps = [p for p in ps if team(p) == args.team]

    print(json.dumps(ps))
