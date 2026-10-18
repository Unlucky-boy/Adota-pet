/**
 * Restringe uma rota aos adotantes autenticados.
 * A sessao administrativa nao da acesso automatico aos dados de um adotante.
 */
function isAdopterAuthenticated(req, res, next) {
  if (req.session && req.session.adopter) {
    return next();
  }

  req.session.error = 'Você precisa estar logado como adotante para acessar seu perfil.';
  return res.redirect('/login');
}

module.exports = isAdopterAuthenticated;
