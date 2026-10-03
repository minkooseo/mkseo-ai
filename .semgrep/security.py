import json
import subprocess

import httpx
import httpx2


def parse_model_output(text: str):
    # ruleid: no-dynamic-code-python
    eval(text)
    # ruleid: no-dynamic-code-python
    exec(text)
    # ok: no-dynamic-code-python
    return json.loads(text)


def launch(command: str):
    # ruleid: no-subprocess-shell
    subprocess.run(command, shell=True, check=True)
    # ok: no-subprocess-shell
    subprocess.run([command], check=True)


# ruleid: require-http-certificate-verification
httpx.Client(verify=False)
# ruleid: require-http-certificate-verification
httpx.AsyncClient(verify=False)
# ruleid: require-http-certificate-verification
httpx2.Client(verify=False)
# ruleid: require-http-certificate-verification
httpx2.AsyncClient(verify=False)
# ok: require-http-certificate-verification
httpx.Client(verify=True)
# ok: require-http-certificate-verification
httpx2.AsyncClient(verify=True)
