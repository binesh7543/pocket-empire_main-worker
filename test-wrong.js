// Fixed syntax error
export default {
  async fetch(request, env) {
    return new Response('OK'); // यहाँ अब ब्रैकेट बंद है
  }
}
