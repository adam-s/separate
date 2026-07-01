<footer class="colophon">
  <p>
    Built with Svelte and d3. The walkthrough runs from precomputed data, right in your
    browser. The audio labeling that produced that data is done offline (see the repo).
  </p>
  <p class="note">
    Demo music: <a href="https://incompetech.com/">“Dance Monster” by Kevin MacLeod</a>,
    licensed <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.
  </p>
  <p class="meta">
    <a href="https://adamsohn.com/">adamsohn.com</a> ·
    <a href="https://github.com/adam-s">GitHub</a>
  </p>
</footer>

<style>
  .colophon {
    max-width: var(--measure);
    margin: var(--space-2xl) auto 0;
    padding: var(--space-xl) 0 var(--space-3xl);
    border-top: 1px solid var(--border);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--ink-subtle);
  }
  .colophon p {
    margin-bottom: var(--space-sm);
  }
  .note {
    color: var(--ink-muted);
  }
</style>
