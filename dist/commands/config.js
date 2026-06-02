"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigCommand = registerConfigCommand;
const config_1 = require("../core/config");
const logger_1 = require("../utils/logger");
function registerConfigCommand(program) {
    const configCmd = program
        .command('config')
        .description('manage MiMo CLI configuration');
    // mimo config set <key> <value>
    configCmd
        .command('set <key> <value>')
        .description('set a configuration value')
        .action((key, value) => {
        const validKeys = [
            'apiKey', 'baseUrl', 'model', 'temperature', 'maxTokens', 'maxContextTokens',
        ];
        if (!validKeys.includes(key)) {
            logger_1.log.error(`Invalid config key: ${key}`);
            logger_1.log.info(`Available keys: ${validKeys.join(', ')}`);
            return;
        }
        // 数值类型转换
        const numericKeys = ['temperature', 'maxTokens', 'maxContextTokens'];
        let parsedValue = value;
        if (numericKeys.includes(key)) {
            parsedValue = Number(value);
            if (isNaN(parsedValue)) {
                logger_1.log.error(`${key} must be a number`);
                return;
            }
        }
        (0, config_1.set)(key, parsedValue);
        logger_1.log.success(`Set ${key} = ${key === 'apiKey' ? '****' : value}`);
    });
    // mimo config show
    configCmd
        .command('show')
        .description('show current configuration')
        .action(() => {
        const cfg = (0, config_1.showConfig)();
        logger_1.log.info('Current configuration:');
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
        (0, config_1.resetConfig)();
        logger_1.log.success('Configuration reset to defaults');
    });
}
//# sourceMappingURL=config.js.map