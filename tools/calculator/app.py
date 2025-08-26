from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import math
import re
from typing import Union

app = FastAPI(title="Advanced Calculator", version="2.0.0")

class Calculation(BaseModel):
    expression: str

class Result(BaseModel):
    result: Union[float, str]
    expression: str
    formatted_result: str

def safe_eval(expression: str) -> float:
    """Safely evaluate mathematical expressions with enhanced support."""
    
    # Replace common mathematical symbols and functions
    replacements = {
        'π': str(math.pi),
        'pi': str(math.pi),
        'e': str(math.e),
        '^': '**',
        '√': 'sqrt',
        '∞': str(math.inf),
        '×': '*',
        '÷': '/',
        'mod': '%',
        'log': 'log10',  # Default log to base 10
        'ln': 'log',     # Natural log
    }
    
    for old, new in replacements.items():
        expression = expression.replace(old, new)
    
    # Handle implicit multiplication (e.g., 2π, 3(4+5))
    expression = re.sub(r'(\d)([a-zA-Z(])', r'\1*\2', expression)
    expression = re.sub(r'([)])(\d)', r'\1*\2', expression)
    expression = re.sub(r'([)])([(a-zA-Z])', r'\1*\2', expression)
    
    # Create safe namespace with mathematical functions
    safe_dict = {
        "__builtins__": {},
        # Basic math functions
        "abs": abs, "round": round, "min": min, "max": max,
        "sum": sum, "pow": pow,
        
        # Math module functions
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "asin": math.asin, "acos": math.acos, "atan": math.atan,
        "atan2": math.atan2,
        "sinh": math.sinh, "cosh": math.cosh, "tanh": math.tanh,
        "asinh": math.asinh, "acosh": math.acosh, "atanh": math.atanh,
        
        "sqrt": math.sqrt, "cbrt": lambda x: x**(1/3),
        "exp": math.exp, "log": math.log, "log10": math.log10, "log2": math.log2,
        
        "ceil": math.ceil, "floor": math.floor, "trunc": math.trunc,
        "factorial": math.factorial, "gcd": math.gcd,
        
        "degrees": math.degrees, "radians": math.radians,
        
        # Constants
        "pi": math.pi, "e": math.e, "tau": math.tau,
        "inf": math.inf, "nan": math.nan,
    }
    
    return eval(expression, safe_dict)

def format_result(result: float) -> str:
    """Format the result for display."""
    if math.isnan(result):
        return "NaN"
    elif math.isinf(result):
        return "∞" if result > 0 else "-∞"
    elif result == int(result) and abs(result) < 1e15:
        return str(int(result))
    elif abs(result) >= 1e6 or (abs(result) < 1e-4 and result != 0):
        return f"{result:.6e}"
    else:
        return f"{result:.10g}"

@app.get("/", response_class=HTMLResponse)
async def root():
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Calculator</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .calculator {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            width: 100%;
            max-width: 400px;
        }
        
        .header {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            text-align: center;
            padding: 20px;
            font-size: 1.5rem;
            font-weight: 300;
        }
        
        .display {
            background: #1a1a1a;
            color: #00ff41;
            padding: 30px 20px;
            text-align: right;
            font-family: 'Courier New', monospace;
        }
        
        .expression {
            font-size: 1rem;
            color: #888;
            min-height: 1.2rem;
            margin-bottom: 10px;
        }
        
        .result {
            font-size: 2.5rem;
            font-weight: bold;
            min-height: 3rem;
            word-wrap: break-word;
        }
        
        .buttons {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 1px;
            background: #ddd;
        }
        
        .btn {
            border: none;
            padding: 20px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
        }
        
        .btn:hover {
            background: #f0f0f0;
            transform: scale(0.98);
        }
        
        .btn:active {
            transform: scale(0.95);
        }
        
        .btn.operator {
            background: #ff9500;
            color: white;
            font-weight: bold;
        }
        
        .btn.operator:hover {
            background: #e6850e;
        }
        
        .btn.function {
            background: #34495e;
            color: white;
            font-size: 0.9rem;
        }
        
        .btn.function:hover {
            background: #2c3e50;
        }
        
        .btn.clear {
            background: #e74c3c;
            color: white;
            font-weight: bold;
        }
        
        .btn.clear:hover {
            background: #c0392b;
        }
        
        .btn.equals {
            background: #27ae60;
            color: white;
            font-weight: bold;
        }
        
        .btn.equals:hover {
            background: #229954;
        }
        
        .btn.wide {
            grid-column: span 2;
        }
        
        .error {
            color: #e74c3c !important;
        }
        
        .mode-toggle {
            text-align: center;
            padding: 10px;
            background: #f8f9fa;
            border-bottom: 1px solid #ddd;
        }
        
        .mode-btn {
            background: none;
            border: 1px solid #007bff;
            color: #007bff;
            padding: 5px 15px;
            margin: 0 5px;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .mode-btn.active {
            background: #007bff;
            color: white;
        }
    </style>
</head>
<body>
    <div class="calculator">
        <div class="header">Advanced Calculator</div>
        
        <div class="mode-toggle">
            <button class="mode-btn active" onclick="setMode('basic')">Basic</button>
            <button class="mode-btn" onclick="setMode('scientific')">Scientific</button>
        </div>
        
        <div class="display">
            <div class="expression" id="expression"></div>
            <div class="result" id="result">0</div>
        </div>
        
        <div class="buttons" id="buttons">
            <!-- Buttons will be generated by JavaScript -->
        </div>
    </div>

    <script>
        let currentMode = 'basic';
        let expression = '';
        let lastResult = '0';
        let justCalculated = false;
        
        const basicButtons = [
            ['C', '⌫', '(', ')', '/'],
            ['7', '8', '9', '*', 'sqrt'],
            ['4', '5', '6', '-', '^'],
            ['1', '2', '3', '+', 'log'],
            ['0', '.', 'π', 'e', '=']
        ];
        
        const scientificButtons = [
            ['C', '⌫', '(', ')', '/'],
            ['sin', 'cos', 'tan', 'ln', '√'],
            ['7', '8', '9', '*', '^'],
            ['4', '5', '6', '-', '!'],
            ['1', '2', '3', '+', 'mod'],
            ['0', '.', 'π', 'e', '=']
        ];
        
        function setMode(mode) {
            currentMode = mode;
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            renderButtons();
        }
        
        function renderButtons() {
            const buttonsContainer = document.getElementById('buttons');
            const buttons = currentMode === 'basic' ? basicButtons : scientificButtons;
            
            buttonsContainer.innerHTML = '';
            buttonsContainer.style.gridTemplateColumns = `repeat(5, 1fr)`;
            
            buttons.flat().forEach(btnText => {
                const button = document.createElement('button');
                button.className = 'btn';
                button.textContent = btnText;
                button.onclick = () => handleButton(btnText);
                
                // Add special classes
                if (['+', '-', '*', '/', '^', 'mod'].includes(btnText)) {
                    button.classList.add('operator');
                } else if (['sin', 'cos', 'tan', 'ln', 'log', 'sqrt', '√', '!'].includes(btnText)) {
                    button.classList.add('function');
                } else if (btnText === 'C') {
                    button.classList.add('clear');
                } else if (btnText === '=') {
                    button.classList.add('equals');
                }
                
                buttonsContainer.appendChild(button);
            });
        }
        
        function handleButton(btn) {
            const resultElement = document.getElementById('result');
            const expressionElement = document.getElementById('expression');
            
            if (btn === 'C') {
                expression = '';
                lastResult = '0';
                updateDisplay();
                return;
            }
            
            if (btn === '⌫') {
                if (justCalculated) {
                    expression = '';
                    justCalculated = false;
                } else {
                    expression = expression.slice(0, -1);
                }
                updateDisplay();
                return;
            }
            
            if (btn === '=') {
                calculate();
                return;
            }
            
            if (justCalculated && !['+', '-', '*', '/', '^', 'mod'].includes(btn)) {
                expression = '';
                justCalculated = false;
            }
            
            // Handle special functions
            if (['sin', 'cos', 'tan', 'ln', 'log', 'sqrt', '√'].includes(btn)) {
                const func = btn === '√' ? 'sqrt' : btn;
                expression += func + '(';
            } else if (btn === '!') {
                expression += 'factorial(';
            } else if (btn === 'π') {
                expression += 'pi';
            } else {
                expression += btn;
            }
            
            updateDisplay();
        }
        
        function updateDisplay() {
            const resultElement = document.getElementById('result');
            const expressionElement = document.getElementById('expression');
            
            expressionElement.textContent = expression || '';
            resultElement.textContent = expression ? 'calculating...' : lastResult;
            resultElement.classList.remove('error');
            
            if (expression) {
                // Try to evaluate for live preview
                try {
                    setTimeout(() => calculate(true), 100);
                } catch (e) {
                    // Ignore preview errors
                }
            }
        }
        
        async function calculate(preview = false) {
            if (!expression && !preview) return;
            
            const resultElement = document.getElementById('result');
            
            try {
                const response = await fetch('/calculate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        expression: expression || lastResult
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    lastResult = data.formatted_result;
                    resultElement.textContent = lastResult;
                    resultElement.classList.remove('error');
                    
                    if (!preview) {
                        justCalculated = true;
                    }
                } else {
                    throw new Error(data.detail);
                }
            } catch (error) {
                if (!preview) {
                    resultElement.textContent = 'Error';
                    resultElement.classList.add('error');
                    lastResult = '0';
                }
            }
        }
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            const key = e.key;
            
            if (key >= '0' && key <= '9') {
                handleButton(key);
            } else if (['+', '-', '*', '/', '(', ')', '.'].includes(key)) {
                handleButton(key);
            } else if (key === 'Enter' || key === '=') {
                e.preventDefault();
                handleButton('=');
            } else if (key === 'Escape') {
                handleButton('C');
            } else if (key === 'Backspace') {
                e.preventDefault();
                handleButton('⌫');
            }
        });
        
        // Initialize
        renderButtons();
    </script>
</body>
</html>"""

@app.post("/calculate", response_model=Result)
async def calculate(calc: Calculation):
    try:
        expression = calc.expression.strip()
        if not expression:
            raise ValueError("Empty expression")
        
        result = safe_eval(expression)
        formatted = format_result(result)
        
        return Result(
            result=result,
            expression=calc.expression,
            formatted_result=formatted
        )
    except ZeroDivisionError:
        raise HTTPException(status_code=400, detail="Division by zero")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid expression: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)