<script lang="ts">
  import { loadClip, loadClips, type ClipData, type ClipInfo } from './lib/data';
  import { Transport } from './lib/audio/transport.svelte';
  import { recognizer } from './lib/audio/recognizer.svelte';
  import ClipPicker from './lib/components/ClipPicker.svelte';
  import Hero from './lib/components/Hero.svelte';
  import Section from './lib/components/Section.svelte';
  import FigureCard from './lib/components/FigureCard.svelte';
  import Colophon from './lib/components/Colophon.svelte';
  import ToolDemo from './lib/viz/ToolDemo.svelte';
  import PipelineThread from './lib/viz/PipelineThread.svelte';
  import AnalyzerHero from './lib/viz/AnalyzerHero.svelte';
  import SortHero from './lib/viz/SortHero.svelte';
  import MelSpectrogram from './lib/viz/MelSpectrogram.svelte';
  import FilterTraces from './lib/viz/FilterTraces.svelte';
  import AstRibbon from './lib/viz/AstRibbon.svelte';
  import StemExtraction from './lib/viz/StemExtraction.svelte';
  import EngineResult from './lib/viz/EngineResult.svelte';
  import DevicePanel from './lib/components/DevicePanel.svelte';
  import ModelLoader from './lib/components/ModelLoader.svelte';
  import FooterBar from './lib/components/FooterBar.svelte';
  import PlaybackControls from './lib/viz/PlaybackControls.svelte';

  const SECTIONS = [
    { id: 'origin', title: 'How I got here' },
    { id: 'tools', title: 'The tools for the job' },
    { id: 'file', title: 'Pick a real recording' },
    { id: 'live', title: 'It runs in your browser' },
    { id: 'run', title: 'Run it on your clip' },
    { id: 'extract', title: 'Group, and keep the engine' },
    { id: 'target', title: 'The engine, alone' },
  ];

  let clips = $state<ClipInfo[]>([]);
  let activeSlug = $state('');
  let data = $state<ClipData | null>(null);
  let error = $state<string | null>(null);
  // One persistent transport = the single clock every visual reads from.
  const transport = new Transport();

  // Capability gate: decides whether the live model is offered (a later iteration).
  function detectCapable(): boolean {
    if (typeof navigator === 'undefined') return false;
    const hasWebGPU = 'gpu' in navigator;
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
    return hasWebGPU && !isMobile && mem >= 4;
  }
  const capable = detectCapable();

  // Load the clip index, default to the first.
  $effect(() => {
    loadClips()
      .then((c) => {
        clips = c;
        if (!activeSlug && c[0]) activeSlug = c[0].slug;
      })
      .catch((e) => (error = e.message));
  });

  // Load the selected clip and point the one transport at it whenever the choice changes.
  $effect(() => {
    const slug = activeSlug;
    if (!slug) return;
    let cancelled = false;
    loadClip(slug)
      .then((d) => {
        if (cancelled) return;
        data = d;
        const url = d.audioUrl ? import.meta.env.BASE_URL + d.audioUrl : '';
        if (url) transport.load(url, d.durationSec);
      })
      .catch((e) => (error = e.message));
    return () => {
      cancelled = true;
    };
  });
</script>

<a class="wordmark" href="https://adamsohn.com/">adamsohn.com</a>

<main class="page">
  <Hero
    title="Isolating the Engine Audio"
    lede="A while back I wanted to find out whether a model could listen to a car and tell you what's wrong with it. A good mechanic can often name a fault from the sound alone — a worn bearing, a misfire, a failing pump — so the question was whether software could learn the same trick."
  />

  {#if error}
    <p class="error">Couldn't load the sample clip: {error}</p>
  {/if}

  {#if data && transport}
    <AnalyzerHero {data} {transport} />
  {/if}

  {#each SECTIONS as s, i}
    <Section id={s.id} n={i + 1} title={s.title}>
      {#if s.id === 'origin'}
        <p>
          The naive first version was easy. People post short TikToks that show one
          mechanical problem and play the sound right there in the clip, with the bad
          part named on screen. Two minutes, one fault each. Building training labels was
          just splicing out the audio and reading the on-screen text with OCR (optical
          character recognition), then
          <a href="https://adamsohn.com/clap/">matching the words and the picture to the sound</a>.
          It worked, and it was a good
          way to test the idea. It was also a dead end: there are only so many tidy,
          pre-labeled clips.
        </p>
        <p>
          To get more data I had to move to longer, messier videos, full walkarounds,
          diagnosis vlogs, repair logs. They carry far more signal, but it's buried. I
          scraped them, kept the title and comments, ran OCR on the frames, and
          transcribed the narration. That metadata was the easy part.
        </p>
        <p>
          The audio was the hard part. A ten-minute repair video is mostly a person
          talking, often over music, with the actual engine surfacing in short bursts.
          Before any of it is usable you have to clean it: strip out the speech, drop the
          music and the other non-mechanical noise, and keep only the mechanical sound
          underneath. Each of those is its own step in the pipeline.
        </p>
        <p>
          That cleaning step is what this post is about. It's more interesting than it
          sounds, and it runs entirely in your browser. (It's the front end of
          <a href="https://github.com/adam-s/car-diagnosis">car-diagnosis</a>.)
        </p>
        <div class="alsosee">
          <p class="also-label mono">Also see</p>
          <ul>
            <li>
              <a href="https://adamsohn.com/clap/"><strong>CLAP, visualized</strong></a>
              — an interactive walk through the model that turns an isolated engine sound
              into a 512-number fingerprint. It follows one recording through every step
              of the encoder, live in your browser, then measures how well that
              fingerprint matches plain-language descriptions.
            </li>
            <li>
              <a href="https://github.com/adam-s/car-diagnosis/"><strong>car-diagnosis</strong></a>
              — the end-to-end system this cleaning step feeds into: it scrapes fault
              recordings off the web, cleans them, embeds them with CLAP, trains
              classifiers on those embeddings, and serves an inference page where you drop
              in a recording of a rattling car and it tells you what's wrong.
            </li>
          </ul>
        </div>
      {:else if s.id === 'tools' && data}
        <p>
          Isolating one source from a mixture doesn't need a big model. It needs a few
          small, well-chosen pieces, each doing one job. They run as a pipeline, cheap
          stages first, so the expensive model only ever sees what survives.
        </p>

        <div class="pipeline">
          <PipelineThread />
        <h3 data-stage>Log-mel spectrogram</h3>
        <p>
          First, turn the sound into an image: time across, mel-frequency up, loudness as
          brightness. That picture is really just a grid of numbers, one value per
          time-and-frequency cell, and that grid is exactly what gets fed into the neural
          network later. The model reads sound the way an image model reads pixels.
          Computing it is pure signal processing, no model involved yet.
          <a href="https://ketanhdoshi.github.io/Audio-Mel/">A friendly explainer →</a>
        </p>
        <ToolDemo kind="spectrogram" {data} {transport} caption="A waveform (top) and the spectrogram it turns into; press play to scan across it." />

        <h3 data-stage>Two quick checks: loudness and noise</h3>
        <p>
          Before the expensive model runs, two fast checks throw away the parts of the
          clip that obviously won't help. The audio is chopped into tiny slices, a
          fraction of a second each, and every slice is scored two ways.
        </p>
        <p>
          <strong>Is anything there?</strong> If a slice is basically silent, drop it.
          (The standard way to measure loudness is called RMS energy.)
          <strong>Or is it just noise?</strong> Wind, hiss, and static spread their energy
          evenly across all pitches with no clear peaks, so they sound featureless rather
          than like a real sound. That evenness is easy to measure, and those slices get
          dropped too. (This measure is called spectral flatness.)
        </p>
        <p>
          Both are simple arithmetic, no model involved, which is why they're nearly free.
          <a href="https://en.wikipedia.org/wiki/Spectral_flatness">More on spectral flatness →</a>
        </p>
        <ToolDemo kind="filters" {data} {transport} caption="Each over time; spikes in noise-likeness (shaded) mark slices that get dropped." />

        <h3 data-stage>AST — the recognizer</h3>
        <p>
          This is the first actual model in the pipeline. AST (short for Audio Spectrogram
          Transformer) is a ready-made neural network that listens to a short slice of
          sound and guesses what it is, choosing from 500-plus everyday categories. We
          didn't train it: someone else trained it on AudioSet, a huge public collection
          of clips that people labeled by hand.
        </p>
        <p>
          Those categories already include Speech, Music, and Engine, the three we care
          about. So we slide AST across the clip and, slice by slice, it scores how much
          each moment sounds like each one. It's small enough (about 90 MB) to download
          once and run on your computer's graphics chip, right in the browser.
          <a href="https://research.google.com/audioset/">Browse the AudioSet categories →</a>
        </p>
        <ToolDemo kind="ast" {data} {transport} caption="Speech / music / engine scores — the average when paused, the live slice while playing; the tallest bar is the model's call." />

        <h3 data-stage>Silero VAD — sharpen the speech edges</h3>
        <p>
          AST labels each slice only roughly, so the exact moment a voice starts or stops
          can be off by a bit. Silero VAD is a tiny (~2 MB) model that does one thing well:
          detect when a human voice is present. We use it to trim the speech precisely, so a
          stray half-word doesn't leak into the engine sound we're keeping.
          <a href="https://en.wikipedia.org/wiki/Voice_activity_detection">What voice-activity detection is →</a>
        </p>
        <ToolDemo kind="vad" {data} {transport} caption="The waveform with detected speech highlighted; press play and the marker tracks the clock." />

        <h3 data-stage>transformers.js + WebGPU — run it in the browser</h3>
        <p>
          None of this needs a server. transformers.js is a JavaScript library that runs
          AI models right inside a web page, and WebGPU is the browser feature that lets a
          page borrow your computer's graphics chip for the heavy math. Together they
          download each model once, cache it so the next visit is instant, and run
          everything on your own machine, so the audio you feed in never leaves the page.
          <a href="https://huggingface.co/blog/transformersjs-v3">How transformers.js runs on WebGPU →</a>
        </p>
        </div>

        <p>
          Every piece is small enough to run on your own machine. The rest of this shows
          them working together on the clip above.
        </p>
      {:else if s.id === 'file' && data && transport}
        <p>
          These are real clips, each a snippet from a YouTube video of someone diagnosing a
          car by ear: narration over the actual fault. (The last one has a music track mixed
          in, so the "drop the music" step has something to drop.) Pick one and the rest of
          the page analyzes it live, in your browser. Every card links back to the original.
        </p>
        <ClipPicker {clips} active={activeSlug} onpick={(s) => (activeSlug = s)} />
        <FigureCard label="The recording · press play">
          <PlaybackControls {transport} />
        </FigureCard>
        <p>
          Think of it abstractly as a stream of chunks: the person talking, then the
          engine, back and forth. The plan is to sort the chunks by what they are and keep
          only the engine. Drag the button to see the idea.
        </p>
        <FigureCard label="The plan · sort, then keep one group">
          <SortHero />
        </FigureCard>
      {:else if s.id === 'live' && data}
        <p>
          Everything on this page so far — the spectrogram, the filters, the recognizer —
          was computed ahead of time, so the walkthrough works on any device. But the
          recognizer is a real neural network, and there's no reason it has to run on a
          server. You can run it right here, on your own machine. If you'd like to see what
          that's like, this is the place.
        </p>
        <p>
          The model is <strong>AST</strong>, the Audio Spectrogram Transformer — the same
          weights the precomputed panels came from, published on
          <a href="https://huggingface.co/Xenova/ast-finetuned-audioset-10-10-0.4593">Hugging Face</a>
          and trained on Google's AudioSet to know 500-plus everyday sounds.
          <a href="https://github.com/huggingface/transformers.js">transformers.js</a>
          loads it straight into this page, and <strong>WebGPU</strong> hands the matrix
          math to your graphics chip. It downloads once (~{recognizer.sizeMb} MB), caches
          in your browser so the next visit is instant and works offline, and the audio
          never leaves the page — nothing to upload, no server to call.
        </p>
        <FigureCard label="Your device">
          <DevicePanel />
        </FigureCard>
        <p>
          Load it, then slide it across your clip. The per-slice scores it computes — your
          GPU's own numbers — take over the recognizer panel further down, so the same
          visualization runs live. You can flip back to the precomputed values anytime.
        </p>
        <FigureCard
          label="The recognizer · live"
          badge={recognizer.winSlug === activeSlug && recognizer.status === 'ready'
            ? `live · ${recognizer.backend}`
            : 'live · your browser'}
          badgeTone="live"
        >
          <ModelLoader
            audioUrl={data?.audioUrl ? import.meta.env.BASE_URL + data.audioUrl : ''}
            slug={activeSlug}
            durationSec={data.durationSec}
            {capable}
          />
        </FigureCard>
      {:else if s.id === 'run' && data && transport}
        <p>
          Now the whole pipeline on the clip you picked. Press play and watch the stages
          move together on one timeline: the sound as a picture, the two cheap filters,
          and the recognizer's per-slice call.
        </p>
        <FigureCard label="The sound as a picture · spectrogram" badge="precomputed">
          <MelSpectrogram {data} {transport} />
        </FigureCard>
        <FigureCard label="The cheap filters · energy + flatness" badge="precomputed">
          <FilterTraces {data} {transport} />
        </FigureCard>
        {@const liveFrames = recognizer.liveFramesFor(activeSlug)}
        <FigureCard
          label="The recognizer · per-slice class"
          badge={liveFrames ? `live · ${recognizer.backend}` : 'precomputed'}
          badgeTone={liveFrames ? 'live' : 'muted'}
        >
          <AstRibbon {data} {transport} {liveFrames} />
        </FigureCard>
        <PlaybackControls {transport} />
      {:else if s.id === 'extract' && data}
        <p>
          The labels pay off here. Group every chunk by its class and each group becomes
          a stream you can play on its own, pulled from wherever it appeared. The engine
          group is the one we keep, the clean signal we were after.
        </p>
        <FigureCard label="Grouped streams · play each one">
          <StemExtraction {data} {transport} />
        </FigureCard>
      {:else if s.id === 'target' && data && transport}
        <p>
          Drop the other groups and the engine is what remains: a short, clean stream,
          the isolated signal we set out to get.
        </p>
        <FigureCard label="Isolated engine · result">
          <EngineResult {data} />
        </FigureCard>
      {/if}
    </Section>
  {/each}

  <Colophon {capable} />
</main>

{#if clips.length}
  <FooterBar {clips} active={activeSlug} onpick={(s) => (activeSlug = s)} {data} {transport} />
{/if}

<style>
  .wordmark {
    position: fixed;
    top: 0;
    right: var(--space-lg);
    z-index: 20;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    color: var(--ink-muted);
    background: var(--bg);
    border: none;
    border-bottom: 1px solid var(--border-strong);
    padding: var(--space-sm) var(--space-sm) var(--space-xs);
  }
  .wordmark:hover {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .page {
    max-width: 920px;
    margin: 0 auto;
    padding: 0 var(--space-lg) var(--space-2xl);
  }
  .alsosee {
    max-width: var(--measure);
    margin: var(--space-lg) 0 0;
  }
  .alsosee .also-label {
    margin: 0 0 var(--space-sm);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--text-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-subtle);
  }
  .alsosee ul {
    margin: 0;
    padding-left: 1.1em;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .alsosee li {
    color: var(--ink-muted);
    line-height: 1.6;
  }
  .alsosee li strong {
    font-weight: 600;
    color: var(--ink);
  }
  .error {
    margin: var(--space-lg) 0;
    color: var(--adv-neg);
    font-family: var(--font-sans);
  }
  @media (max-width: 600px) {
    .wordmark {
      right: var(--space-md);
    }
  }
</style>
