import { Command } from 'commander';
import { set, resetConfig, showConfig, MiMoConfig } from '../core/config';
import { log } from '../utils/logger';

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('manage MiMo CLI configuration');

  // mimo config set <key> <value>
  configCmd
    .command('set <key> <value>')
    .description('set a configuration value')
    .action((key: string, value: string) => {
      const validKeys: (keyof MiMoConfig)[] = [
        'apiKey', 'baseUrl', 'model', 'temperature', 'maxTokens', 'maxContextTokens',
      ];

      if (!validKeys.includes(key as keyof MiMoConfig)) {
        log.error(`Invalid config key: ${key}`);
        log.info(`Available keys: ${validKeys.join(', ')}`);
        return;
      }

      // 数值类型转换
      const numericKeys = ['temperature', 'maxTokens', 'maxContextTokens'];
      let parsedValue: string | number = value;
      if (numericKeys.includes(key)) {
        parsedValue = Number(value);
        if (isNaN(parsedValue)) {
          log.error(`${key} must be a number`);
          return;
        }
      }

      set(key as keyof MiMoConfig, parsedValue as never);
      log.success(`Set ${key} = ${key === 'apiKey' ? '****' : value}`);
    });

  // mimo config show
  configCmd
    .command('show')
    .description('show current configuration')
    .action(() => {
      const cfg = showConfig();
      log.info('Current configuration:');
      console.log('');
      for (const [key, val] of Object.entries(cfg)) {
        console.log(`  ${key}: ${val}`);
      }
      console.log('');
    });

  // mimo config reset
  configCmd
    .command('reset')
    .description('reset all configuration')
    .action(() => {
      resetConfig();
      log.success('Configuration reset to defaults');
    });
}
