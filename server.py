from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class BenchSpotHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8000), BenchSpotHandler)
    print("Bench Spot is listening on port 8000.")
    print("On this computer: http://127.0.0.1:8000")
    print("On your local network: http://<computer-LAN-IP>:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Bench Spot.")
    finally:
        server.server_close()
