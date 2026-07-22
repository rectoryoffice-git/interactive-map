# Timeline of Gods Polished Map

By making a polished and hyper-tuned interactive model of the history of gods, we could house **the authority** on religious history.

## Goals

### 1. Ensure Historical Accuracy

The history of religion is convoluted and is not always agreed upon. We need this to be reflected through extensive research and visual disclaimers for users. We can achieve this by compiling all of the best-known timelines, documents, and other relevant sources.

### 2. Visual Appeal

The timeline must be aesthetically pleasing both to look at and interact with. It must work at a variety of scales and as both a static and interactive page. Details must be clearly readable, and dates and information should be accessible even at a small scale.

### 3. Futureproofing

The backend infrastructure must be malleable and readable enough to ensure that future corrections or additions to the timeline can be implemented seamlessly. Documentation should be thorough.

## The Plan

### Step 1: Compiling Documents

- We will compile all relevant scholarly media, as well as our own current timeline.
- We will run a thorough search for Wikidata surrounding religions. Lane Rasberry has sent a link to such a search.
- We will establish a comprehensive list of religions to include.
- We will use Claude AI to analyze these datasets and pull the relevant information on each religion. This will include its date, high-level description, key philosophies, regions, branches, current status, and key deities and powers. All sources relevant to the compilation of each religion should be stored as well. Missing data should be marked.
- We will sift through missing data and search for new sources. We will note disputed or missing data, as it will need special representation in the final graph.

### Step 2: Verification

- With our compiled timeline data, we will run heavy verification. First, we will conduct a few rounds of AI verification and manually verify the information it provides. Then, we will reach out to scholars in the field to review the timeline and spot any misleading information.
- We will check that all compiled sources are reputable.

### Step 3: Visual Rebuild

- Using p5.js for simple integration, we will rebuild the tree formatting of the timeline. We will focus on modularity to maintain futureproofing (see Goals).
- We will improve the information sidebar to make it more accessible and interesting.

### Step 4: Publishing

- We will first publish the site to ULC websites.
- We will publish it to ULC Wikipedia.
- We will create a non-trademarked version of the timeline to supplement the Wikipedia religions page.
- We will work with Lane further to increase the page's visibility.
