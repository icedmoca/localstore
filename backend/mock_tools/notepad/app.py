from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head><title>Notepad</title></head>
    <body>
        <h1>Notepad</h1>
        <textarea id="content" rows="20" cols="80" placeholder="Start typing..."></textarea>
        <br>
        <button onclick="save()">Save</button>
        <button onclick="load()">Load</button>
        <div id="status"></div>
        <script>
            async function save() {
                const content = document.getElementById('content').value;
                const response = await fetch('/save', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({content: content})
                });
                const result = await response.json();
                document.getElementById('status').textContent = result.message;
            }
            
            async function load() {
                const response = await fetch('/load');
                const result = await response.json();
                document.getElementById('content').value = result.content || '';
                document.getElementById('status').textContent = 'Loaded';
            }
        </script>
    </body>
    </html>
    '''

@app.route('/save', methods=['POST'])
def save():
    data = request.get_json()
    content = data.get('content', '')
    # In a real app, this would save to a file
    return jsonify({'message': 'Saved successfully'})

@app.route('/load')
def load():
    # In a real app, this would load from a file
    return jsonify({'content': 'Sample content'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
