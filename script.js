document.addEventListener('DOMContentLoaded', function () {
    // DOM元素
    const modeBtns = document.querySelectorAll('.mode-btn');
    const calculatorModes = document.querySelectorAll('.calculator-mode');
    
    // 标准模式新DOM（表达式+结果）
    const expressionDisplay = document.querySelector('#standard-mode .expression');
    const resultDisplay = document.querySelector('#standard-mode .result');
    
    // 兼容旧DOM（用于其他模式）
    const previousOperandText = document.querySelectorAll('.previous-operand');
    const currentOperandText = document.querySelectorAll('.current-operand');

    // 标准计算器变量（新）
    let currentExpression = '0';
    let needsReset = false;
    let currentMode = 'standard';

    // 程序员计算器变量
    let currentRadix = 16;
    let bitLength = 32;
    const bitDisplay = document.querySelector('.bit-display');

    // 设置当前日期为默认值
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('date1').value = formattedDate;
    document.getElementById('date2').value = formattedDate;

    // 切换计算器模式
    modeBtns.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            currentMode = mode;
            modeBtns.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            calculatorModes.forEach(calculatorMode => {
                calculatorMode.classList.add('hidden');
            });
            document.getElementById(`${mode}-mode`).classList.remove('hidden');
            if (mode === 'standard') {
                resetCalculator();
            } else if (mode === 'programmer') {
                resetProgrammerCalculator();
            } else if (mode === 'date') {
                updateDateCalculatorUI();
            } else if (mode === 'math') {
                updateMathCalculatorUI();
            }
        });
    });

    // ======================
    // 标准模式：表达式输入
    // ======================
    function resetCalculator() {
        currentExpression = '0';
        needsReset = false;
        expressionDisplay.textContent = '0';
        resultDisplay.textContent = '0';
    }

    function appendToExpression(symbol) {
        if (needsReset) {
            currentExpression = '0';
            needsReset = false;
        }

        // 符号映射
        let mapped = symbol;
        const mappings = {
            '√': 'sqrt(',
            'x^y': '**',
            '÷': '/',
            '×': '*',
            '|x|': 'abs(',
            'π': 'pi',
            'e': 'e',
            'sin': 'sin(',
            'cos': 'cos(',
            'tan': 'tan(',
            'log': 'log(',
            'ln': 'ln('
        };
        if (mappings[symbol] !== undefined) {
            mapped = mappings[symbol];
        }

        // 初始状态处理
        if (currentExpression === '0' && !['+', '-', '*', '/', '(', ')'].includes(mapped)) {
            currentExpression = mapped;
        } else {
            currentExpression += mapped;
        }

        expressionDisplay.textContent = currentExpression;
    }

    function evaluateExpression() {
        if (needsReset) return;

        try {
            const result = parseMathExpression(currentExpression);
            resultDisplay.textContent = result;
            needsReset = true;
        } catch (e) {
            resultDisplay.textContent = 'Error';
            console.error(e);
        }
    }

    function deleteLastChar() {
        if (needsReset) return;
        if (currentExpression.length > 1) {
            currentExpression = currentExpression.slice(0, -1);
        } else {
            currentExpression = '0';
        }
        expressionDisplay.textContent = currentExpression;
    }

    // 标准模式按钮事件
    document.querySelectorAll('#standard-mode .btn').forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('number')) {
                appendToExpression(button.textContent);
            } else if (button.classList.contains('operation') || 
                       button.classList.contains('func') || 
                       button.classList.contains('const')) {
                appendToExpression(button.textContent);
            } else if (button.classList.contains('equals')) {
                evaluateExpression();
            } else if (button.classList.contains('clear')) {
                resetCalculator();
            } else if (button.classList.contains('delete')) {
                deleteLastChar();
            }
        });
    });

    // ======================
    // 安全表达式解析器（通用）
    // ======================
    function parseMathExpression(expr) {
        if (!expr || !expr.trim()) return NaN;

        let input = expr.trim();

        // 自动将 ^ 替换为 **
        input = input.replace(/\^/g, '**');

        // 白名单函数和常数替换
        input = input
            .replace(/\babs\(/g, 'Math.abs(')
            .replace(/\bcbrt\(/g, 'Math.cbrt(')
            .replace(/\bsqrt\(/g, 'Math.sqrt(')
            .replace(/\blog10\(/g, 'Math.log10(')
            .replace(/\blog\(/g, 'Math.log10(')   // log 默认为常用对数
            .replace(/\bln\(/g, 'Math.log(')
            .replace(/\bsin\(/g, 'Math.sin(')
            .replace(/\bcos\(/g, 'Math.cos(')
            .replace(/\btan\(/g, 'Math.tan(')
            .replace(/\basin\(/g, 'Math.asin(')
            .replace(/\bacos\(/g, 'Math.acos(')
            .replace(/\batan\(/g, 'Math.atan(')
            .replace(/\bpi\b/g, 'Math.PI')
            .replace(/\be\b/g, 'Math.E');

        try {
            const fn = new Function('return (' + input + ');');
            const result = fn();
            
            if (typeof result !== 'number' || !isFinite(result)) {
                throw new Error('结果无效');
            }
            
            return result;
        } catch (e) {
            throw new Error(`"${expr}" 无法计算。示例：sqrt(2), sin(pi/2), log(100), 2**3`);
        }
    }

    // ======================
    // 程序员计算器（保持不变）
    // ======================
    let firstOperand = '';
    let secondOperand = '';
    let currentOperation = null;
    let shouldResetScreen = false;
    let pendingFunction = null;

    function resetProgrammerCalculator() {
        firstOperand = '';
        secondOperand = '';
        currentOperation = null;
        pendingFunction = null;
        if (previousOperandText[1]) previousOperandText[1].textContent = '';
        if (currentOperandText[1]) currentOperandText[1].textContent = '0';
        shouldResetScreen = false;
        updateBitDisplay();
    }

    function inputProgrammerNumber(number) {
        if (currentMode !== 'programmer') return;
        const validDigits = {
            2: /[0-1]/,
            8: /[0-7]/,
            10: /[0-9]/,
            16: /[0-9A-F]/i
        };
        if (!validDigits[currentRadix].test(number)) return;
        const display = currentOperandText[1];
        if (!display) return;
        if (display.textContent === '0' || shouldResetScreen) {
            display.textContent = number;
            shouldResetScreen = false;
        } else {
            display.textContent += number;
        }
        updateBitDisplay();
    }

    function deleteProgrammerNumber() {
        if (currentMode !== 'programmer') return;
        const display = currentOperandText[1];
        if (!display) return;
        display.textContent = display.textContent.slice(0, -1);
        if (display.textContent === '') {
            display.textContent = '0';
        }
        updateBitDisplay();
    }

    function inputProgrammerOperation(operation) {
        if (currentMode !== 'programmer') return;
        if (currentOperation !== null) evaluateProgrammer();
        const display = currentOperandText[1];
        if (!display) return;
        firstOperand = display.textContent;
        currentOperation = operation;
        if (previousOperandText[1]) {
            previousOperandText[1].textContent = `${firstOperand} ${operation}`;
        }
        shouldResetScreen = true;
    }

    function evaluateProgrammer() {
        if (currentMode !== 'programmer') return;
        if (currentOperation === null) return;
        const display = currentOperandText[1];
        if (!display) return;
        secondOperand = display.textContent;
        const num1 = parseInt(firstOperand, currentRadix);
        const num2 = parseInt(secondOperand, currentRadix);
        let result;
        switch (currentOperation) {
            case 'AND':
                result = num1 & num2;
                break;
            case 'OR':
                result = num1 | num2;
                break;
            case 'XOR':
                result = num1 ^ num2;
                break;
            case 'NOT':
                const mask = (1 << bitLength) - 1;
                result = (~num1) & mask;
                break;
            case '<<':
                result = num1 << num2;
                break;
            case '>>':
                result = num1 >> num2;
                break;
            case 'MOD':
                result = num1 % num2;
                break;
            default:
                return;
        }
        const bitmask = (1n << BigInt(bitLength)) - 1n;
        result = Number(BigInt(result) & bitmask);
        display.textContent = result.toString(currentRadix).toUpperCase();
        if (previousOperandText[1]) {
            previousOperandText[1].textContent = `${firstOperand} ${currentOperation} ${secondOperand} =`;
        }
        currentOperation = null;
        shouldResetScreen = true;
        updateBitDisplay();
    }

    function updateBitDisplay() {
        if (currentMode !== 'programmer') return;
        const display = currentOperandText[1];
        if (!display) return;
        const decimalValue = parseInt(display.textContent, currentRadix);
        let binaryStr = decimalValue.toString(2).padStart(bitLength, '0');
        let formattedBinary = '';
        for (let i = 0; i < binaryStr.length; i++) {
            formattedBinary += binaryStr[i];
            if ((i + 1) % 4 === 0 && i !== binaryStr.length - 1) {
                formattedBinary += ' ';
            }
        }
        bitDisplay.textContent = formattedBinary;
    }

    function updateDisplay(mode) {
        if (mode === 'programmer') {
            const display = currentOperandText[1];
            if (!display) return;
            const decimalValue = parseInt(display.textContent, currentRadix);
            display.textContent = decimalValue.toString(currentRadix).toUpperCase();
        }
    }

    // ======================
    // 日期计算器（保持不变）
    // ======================
    function updateDateCalculatorUI() {
        const operation = document.getElementById('date-operation').value;
        const daysGroup = document.getElementById('days-group');
        if (operation === 'diff') {
            daysGroup.style.display = 'none';
        } else {
            daysGroup.style.display = 'block';
        }
    }

    function calculateDate() {
        const date1 = new Date(document.getElementById('date1').value);
        const date2 = new Date(document.getElementById('date2').value);
        const operation = document.getElementById('date-operation').value;
        const daysValue = parseInt(document.getElementById('days-value').value);
        const resultElement = document.getElementById('date-result');

        if (isNaN(date1.getTime()) || (operation !== 'diff' && isNaN(daysValue))) {
            resultElement.textContent = '请输入有效的日期和天数';
            return;
        }

        let result;
        switch (operation) {
            case 'diff':
                if (isNaN(date2.getTime())) {
                    resultElement.textContent = '请输入有效的第二个日期';
                    return;
                }
                const diffTime = Math.abs(date2 - date1);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                result = `两个日期之间相差 ${diffDays} 天`;
                break;
            case 'add':
                const newDate = new Date(date1);
                newDate.setDate(date1.getDate() + daysValue);
                result = `${date1.toLocaleDateString()} 加上 ${daysValue} 天是 ${newDate.toLocaleDateString()}`;
                break;
            case 'subtract':
                const resultDate = new Date(date1);
                resultDate.setDate(date1.getDate() - daysValue);
                result = `${date1.toLocaleDateString()} 减去 ${daysValue} 天是 ${resultDate.toLocaleDateString()}`;
                break;
            default:
                result = '请选择计算类型';
        }
        resultElement.textContent = result;
    }

    function resetDateCalculator() {
        document.getElementById('date1').value = formattedDate;
        document.getElementById('date2').value = formattedDate;
        document.getElementById('days-value').value = '0';
        document.getElementById('date-result').textContent = '选择日期和操作';
    }

    // ======================
    // 数学计算器（保持不变）
    // ======================
    function updateMathCalculatorUI() {
        const operation = document.getElementById('math-operation').value;
        const quadraticCoeffs = document.getElementById('quadratic-coeffs');
        const inequalitySign = document.getElementById('inequality-sign');
        const absOptions = document.querySelectorAll('.abs-options');
        const resultElement = document.getElementById('math-result');

        quadraticCoeffs.style.display = 'none';
        inequalitySign.style.display = 'none';
        absOptions.forEach(opt => opt.style.display = 'none');

        if (operation === 'quadratic-equation' || operation === 'quadratic-inequality') {
            quadraticCoeffs.style.display = 'grid';
        }
        if (operation === 'quadratic-inequality') {
            inequalitySign.style.display = 'block';
        }
        if (operation === 'absolute-inequality') {
            absOptions.forEach(opt => opt.style.display = 'block');
            updateAbsUI();
        }
        resultElement.textContent = '输入参数并计算';
    }

    function updateAbsUI() {
        const absType = document.getElementById('abs-expr-type').value;
        document.getElementById('abs-linear-coeffs').style.display = absType === 'linear' ? 'grid' : 'none';
        document.getElementById('abs-quadratic-coeffs').style.display = absType === 'quadratic' ? 'grid' : 'none';
    }

    function calculateMath() {
        const operation = document.getElementById('math-operation').value;
        const resultElement = document.getElementById('math-result');
        let result = '';

        try {
            if (operation === 'quadratic-equation') {
                const a = parseMathExpression(document.getElementById('a-value').value);
                const b = parseMathExpression(document.getElementById('b-value').value);
                const c = parseMathExpression(document.getElementById('c-value').value);
                if (isNaN(a) || isNaN(b) || isNaN(c) || a === 0) {
                    result = '请输入有效的 a, b, c（a ≠ 0）';
                } else {
                    const discriminant = b * b - 4 * a * c;
                    if (discriminant > 0) {
                        const root1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                        const root2 = (-b - Math.sqrt(discriminant)) / (2 * a);
                        result = `根: x₁ = ${root1.toFixed(6)}, x₂ = ${root2.toFixed(6)}`;
                    } else if (discriminant === 0) {
                        const root = -b / (2 * a);
                        result = `重根: x = ${root.toFixed(6)}`;
                    } else {
                        const real = (-b / (2 * a)).toFixed(6);
                        const imag = (Math.sqrt(-discriminant) / (2 * a)).toFixed(6);
                        result = `复根: x = ${real} ± ${imag}i`;
                    }
                }
            }
            else if (operation === 'quadratic-inequality') {
                const a = parseMathExpression(document.getElementById('a-value').value);
                const b = parseMathExpression(document.getElementById('b-value').value);
                const c = parseMathExpression(document.getElementById('c-value').value);
                const sign = document.getElementById('ineq-sign').value;
                if (isNaN(a) || isNaN(b) || isNaN(c) || a === 0) {
                    result = '请输入有效的 a, b, c（a ≠ 0）';
                } else {
                    const discriminant = b * b - 4 * a * c;
                    if (discriminant < 0) {
                        if ((a > 0 && (sign === '>' || sign === '>=')) || (a < 0 && (sign === '<' || sign === '<='))) {
                            result = '解集：全体实数 ℝ';
                        } else {
                            result = '解集：∅（空集）';
                        }
                    } else if (discriminant === 0) {
                        const root = -b / (2 * a);
                        if (sign === '>') {
                            result = a > 0 ? `x ≠ ${root.toFixed(6)}` : '∅';
                        } else if (sign === '<') {
                            result = a < 0 ? `x ≠ ${root.toFixed(6)}` : '∅';
                        } else if (sign === '>=') {
                            result = a > 0 ? 'ℝ' : `x = ${root.toFixed(6)}`;
                        } else if (sign === '<=') {
                            result = a < 0 ? 'ℝ' : `x = ${root.toFixed(6)}`;
                        }
                    } else {
                        const r1 = (-b - Math.sqrt(discriminant)) / (2 * a);
                        const r2 = (-b + Math.sqrt(discriminant)) / (2 * a);
                        const [left, right] = r1 < r2 ? [r1, r2] : [r2, r1];
                        const lStr = left.toFixed(6);
                        const rStr = right.toFixed(6);

                        if (a > 0) {
                            if (sign === '>') result = `x < ${lStr} 或 x > ${rStr}`;
                            else if (sign === '<') result = `${lStr} < x < ${rStr}`;
                            else if (sign === '>=') result = `x ≤ ${lStr} 或 x ≥ ${rStr}`;
                            else if (sign === '<=') result = `${lStr} ≤ x ≤ ${rStr}`;
                        } else {
                            if (sign === '>') result = `${lStr} < x < ${rStr}`;
                            else if (sign === '<') result = `x < ${lStr} 或 x > ${rStr}`;
                            else if (sign === '>=') result = `${lStr} ≤ x ≤ ${rStr}`;
                            else if (sign === '<=') result = `x ≤ ${lStr} 或 x ≥ ${rStr}`;
                        }
                    }
                }
            }
            else if (operation === 'absolute-inequality') {
                const absType = document.getElementById('abs-expr-type').value;
                const sign = document.getElementById('abs-ineq-sign').value;
                let k = parseMathExpression(document.getElementById('k-value').value);
                if (isNaN(k)) throw new Error('k 必须是有效表达式');

                if (absType === 'linear') {
                    let a = parseMathExpression(document.getElementById('abs-a-linear').value);
                    let b = parseMathExpression(document.getElementById('abs-b-linear').value);
                    if (isNaN(a) || isNaN(b) || a === 0) throw new Error('a ≠ 0');

                    if (k < 0) {
                        result = '无解（|...| ≥ 0 恒成立）';
                    } else if (k === 0) {
                        if (sign === '>') result = `x ≠ ${(-b / a).toFixed(6)}`;
                        else if (sign === '<') result = '无解';
                        else if (sign === '>=') result = '全体实数 ℝ';
                        else if (sign === '<=') result = `x = ${(-b / a).toFixed(6)}`;
                    } else {
                        const leftVal = (-b - k) / a;
                        const rightVal = (-b + k) / a;
                        const L = Math.min(leftVal, rightVal).toFixed(6);
                        const R = Math.max(leftVal, rightVal).toFixed(6);

                        if (sign === '<') {
                            result = `${L} < x < ${R}`;
                        } else if (sign === '<=') {
                            result = `${L} ≤ x ≤ ${R}`;
                        } else if (sign === '>') {
                            result = `x < ${L} 或 x > ${R}`;
                        } else if (sign === '>=') {
                            result = `x ≤ ${L} 或 x ≥ ${R}`;
                        }
                    }
                } else {
                    result = '⚠️ 一元二次绝对值不等式需分段讨论，建议手动分析或使用图形法。';
                }
            }
        } catch (e) {
            result = '输入错误: ' + e.message;
        }

        resultElement.textContent = result;
    }

    function resetMathCalculator() {
        document.getElementById('a-value').value = '1';
        document.getElementById('b-value').value = '0';
        document.getElementById('c-value').value = '0';
        document.getElementById('ineq-sign').value = '>';
        document.getElementById('abs-expr-type').value = 'linear';
        document.getElementById('abs-a-linear').value = '1';
        document.getElementById('abs-b-linear').value = '0';
        document.getElementById('abs-a-quad').value = '1';
        document.getElementById('abs-b-quad').value = '0';
        document.getElementById('abs-c-quad').value = '0';
        document.getElementById('abs-ineq-sign').value = '>';
        document.getElementById('k-value').value = '0';
        document.getElementById('math-result').textContent = '选择计算类型';
        updateMathCalculatorUI();
    }

    // ======================
    // 说明书按钮交互
    // ======================
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeBtn = document.querySelector('.close-btn');

    if (helpBtn && helpModal && closeBtn) {
        helpBtn.addEventListener('click', () => {
            helpModal.classList.remove('hidden');
        });

        closeBtn.addEventListener('click', () => {
            helpModal.classList.add('hidden');
        });

        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.add('hidden');
            }
        });
    }

    // 初始化
    updateDateCalculatorUI();
    updateMathCalculatorUI();
});