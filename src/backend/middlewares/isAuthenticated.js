/**
 * Middleware que verifica se o usuário está autenticado via sessão.
 * Redireciona para /login caso não esteja.
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.error = 'Você precisa estar logado para acessar esta página.';
  return res.redirect('/login');
}

module.exports = isAuthenticated;
