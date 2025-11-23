function createLogger(options) {
  if (!options) options = {};
  switch (options.output) {
    case 'none':
      return new VoidLogger(options);
    case 'console':
    default:
      return new ConsoleLogger(options);
  }
}
