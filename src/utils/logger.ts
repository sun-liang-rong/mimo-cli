import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.cyan('[info]'), msg),
  success: (msg: string) => console.log(chalk.green('[ok]'), msg),
  warn: (msg: string) => console.log(chalk.yellow('[warn]'), msg),
  error: (msg: string) => console.log(chalk.red('[error]'), msg),
  debug: (msg: string) => console.log(chalk.gray('[debug]'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),

  userInput: (msg: string) => console.log(chalk.green.bold('user'), msg),
  aiReply: (msg: string) => console.log(chalk.blue.bold('assistant'), msg),
  system: (msg: string) => console.log(chalk.gray('[system]'), msg),

  code: (code: string, lang?: string) => {
    const header = lang ? chalk.gray(`-- ${lang} --`) : chalk.gray('-- code --');
    console.log(header);
    console.log(chalk.dim(code));
    console.log(chalk.gray('-'.repeat(40)));
  },

  plain: (msg: string) => console.log(msg),
  write: (text: string) => process.stdout.write(text),
  newline: () => console.log(),
};
