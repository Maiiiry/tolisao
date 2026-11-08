// o cucumber da API (servidor/): as features em português são a especificação, os passos ficam em specs/passos
module.exports = {
  default: {
    paths: ['specs/features/*.feature'],
    require: ['specs/passos/*.cjs'],
    format: ['progress'],
    formatOptions: { snippetInterface: 'async-await' },
  },
};
