using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "main", worker = (
      modules = [(name = "test.mjs", esModule = embed "../.artifacts/worker-test.mjs")],
      compatibilityDate = "2026-10-01", globalOutbound = "fixture"
    )),
    (name = "fixture", worker = (
      modules = [(name = "fixture.mjs", esModule = "export default { fetch(request) { const path = new URL(request.url).pathname; return Response.json(path.startsWith('/app/') ? {token:'fixture-token',expires_at:'2027-01-01T00:00:00Z'} : path.startsWith('/users/') ? [{id:1,name:'one',full_name:'nick/one',owner:{login:'nick'},default_branch:'main',html_url:'https://github.com/nick/one'}] : {items:[],total_count:0}); } };")],
      compatibilityDate = "2026-10-01"
    ))
  ]
);
