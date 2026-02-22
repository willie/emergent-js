import { validateChatInput } from '../lib/chat/validation';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function main() {
    console.log('Starting validation tests...');

    // Test 1: Valid user message
    console.log('Test 1: Valid user message');
    let result = validateChatInput([{ role: 'user', content: 'hello' }]);
    assert(result.isValid === true, 'Valid user message should be valid');

    // Test 2: System message (should fail)
    console.log('Test 2: System message');
    result = validateChatInput([{ role: 'system', content: 'bad' }]);
    assert(result.isValid === false, 'System message should be invalid');
    assert(result.error?.includes('System role') ?? false, 'Error should mention system role');

    // Test 3: Empty array (should fail)
    console.log('Test 3: Empty array');
    result = validateChatInput([]);
    assert(result.isValid === false, 'Empty array should be invalid');

    // Test 4: Non-array (should fail)
    console.log('Test 4: Non-array');
    result = validateChatInput({});
    assert(result.isValid === false, 'Non-array should be invalid');

    // Test 5: Missing role (should fail)
    console.log('Test 5: Missing role');
    result = validateChatInput([{ content: 'hi' }]);
    assert(result.isValid === false, 'Missing role should be invalid');

    // Test 6: Assistant message (should be valid)
    console.log('Test 6: Assistant message');
    result = validateChatInput([{ role: 'assistant', content: 'hi' }]);
    assert(result.isValid === true, 'Assistant message should be valid');

    // Test 7: Tool message (should be valid)
    console.log('Test 7: Tool message');
    result = validateChatInput([{ role: 'tool', content: 'result', tool_call_id: '123' }]);
    assert(result.isValid === true, 'Tool message should be valid');

    console.log('All validation tests passed!');
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
