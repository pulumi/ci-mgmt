import os
import json

print(json.dumps(sorted(os.listdir('../provider-ci/providers'))))
