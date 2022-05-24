import os
import json

print(json.dumps(sorted(os.listdir('../native-provider-ci/providers'))))
