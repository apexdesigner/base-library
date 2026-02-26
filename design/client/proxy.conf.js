const target = `http://localhost:${process.env.PORT || 3000}`;

module.exports = {
  "/api": {
    target,
    secure: false,
  },
};
