type Token = { type: 'NUMBER'; value: number } | { type: 'OPERATOR'; value: string };

export function evaluateExpression(input: string): number | null {
  const cleanInput = input.replace(/\s+/g, '');
  if (!cleanInput) return null;

  const tokens: Token[] = [];
  let currentNum = '';

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];

    if (/[0-9.]/.test(char)) {
      currentNum += char;
    } else if (['+', '-', '*', '/'].includes(char)) {
      if (currentNum !== '') {
        const parsedVal = parseFloat(currentNum);
        if (!isNaN(parsedVal)) {
          tokens.push({ type: 'NUMBER', value: parsedVal });
        }
        currentNum = '';
      }
      tokens.push({ type: 'OPERATOR', value: char });
    }
  }

  if (currentNum !== '') {
    const parsedVal = parseFloat(currentNum);
    if (!isNaN(parsedVal)) {
      tokens.push({ type: 'NUMBER', value: parsedVal });
    }
  }

  if (tokens.length === 0) return null;

  while (tokens.length > 0 && tokens[tokens.length - 1].type === 'OPERATOR') {
    tokens.pop();
  }

  if (tokens.length === 0) return null;

  try {
    const intermediateTokens: (Token | number)[] = [];
    let idx = 0;

    while (idx < tokens.length) {
      const currentToken = tokens[idx];

      if (currentToken.type === 'OPERATOR' && (currentToken.value === '*' || currentToken.value === '/')) {
        const op = currentToken.value;
        const prev = intermediateTokens.pop();
        const nextToken = tokens[idx + 1];

        if (prev !== undefined && typeof prev === 'number' && nextToken && nextToken.type === 'NUMBER') {
          const nextVal = nextToken.value;
          let result = 0;
          if (op === '*') {
            result = prev * nextVal;
          } else {
            result = nextVal === 0 ? 0 : prev / nextVal;
          }
          intermediateTokens.push(result);
          idx += 2;
        } else {
          if (prev !== undefined) {
            intermediateTokens.push(prev);
          }
          intermediateTokens.push(currentToken);
          idx++;
        }
      } else {
        intermediateTokens.push(currentToken.type === 'NUMBER' ? currentToken.value : currentToken);
        idx++;
      }
    }

    if (intermediateTokens.length === 0) return null;

    let result = typeof intermediateTokens[0] === 'number' ? intermediateTokens[0] : 0;
    let currentOp: string | null = null;

    for (let i = 1; i < intermediateTokens.length; i++) {
      const item = intermediateTokens[i];

      if (typeof item === 'object' && item.type === 'OPERATOR') {
        currentOp = item.value;
      } else if (typeof item === 'number') {
        if (currentOp === '+') {
          result += item;
        } else if (currentOp === '-') {
          result -= item;
        }
        currentOp = null;
      }
    }

    return parseFloat(result.toFixed(2));
  } catch (error) {
    console.error('Math expression evaluation error:', error);
    return null;
  }
}
