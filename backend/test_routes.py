from flask import Flask, jsonify

app = Flask(__name__)

@app.get("/api/test1")
def test1():
    return jsonify({"test": "route 1 working"})

@app.get("/api/test2")
def test2():
    return jsonify({"test": "route 2 working"})

@app.get("/api/test3")
def test3():
    return jsonify({"test": "route 3 working"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=True)
