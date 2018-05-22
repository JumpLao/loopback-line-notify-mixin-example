'use strict';

module.exports = function(Sample) {
  Sample.observe('after save', async function(ctx) {
    if (!ctx.instance || ctx.isNewInstance) {
      return Promise.resolve();
    }
    try {
      await ctx.instance.lineNotify(`Sample ${ctx.instance.id} has been modified`);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  });
};
