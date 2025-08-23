from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head><title>Calculator</title></head>
    <body>
        <h1>Calculator</h1>
        <input type="number" id="a" placeholder="First number">
        <input type="number" id="b" placeholder="Second number">
        <button onclick="calculate()">Calculate</button>
        <div id="result"></div>
        <script>
            async function calculate() {
                const a = document.getElementById('a').value;
                const b = document.getElementById('b').value;
                const response = await fetch('/add', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({a: parseFloat(a), b: parseFloat(b)})
                });
                const result = await response.json();
                document.getElementById('result').textContent = result.result;
            }
        </script>
    </body>
    </html>
    '''

@app.route('/add', methods=['POST'])
def add():
    data = request.get_json()
    a = data.get('a', 0)
    b = data.get('b', 0)
    return jsonify({'result': a + b})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
