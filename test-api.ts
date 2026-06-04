import { loadConfig } from './src/config/store.js';
import { MiMoClient } from './src/api/client.js';

async function test() {
  const config = await loadConfig();
  const client = new MiMoClient(config);

  console.log('Testing API...');
  let output = '';
  for await (const event of client.streamChat([{ role: 'user', content: '1+1等于几？' }])) {
    if (event.type === 'text' && event.content) {
      output += event.content;
      process.stdout.write(event.content);
    }
  }
  console.log('\nDone');
  console.log('Total output length:', output.length);
}

test().catch(console.error);
