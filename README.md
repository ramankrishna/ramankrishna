<p align="center">
  <img src="./assets/hero.svg" alt="Rama Krishna Bachu — Training small specialized language models end-to-end" width="100%" />
</p>

<p align="center"><em>Software Engineer at Lowe's · MS CS, University of New Haven · Independent SLM research as <a href="https://bottensor.xyz">Bottensor</a></em></p>

## Currently

<table>
  <tr>
    <td width="180"><b>Bottensor</b></td>
    <td>Open-source SLM research line. Training, serving, routing, and multi-agent orchestration as one stack. <a href="https://bottensor.xyz">bottensor.xyz</a></td>
  </tr>
  <tr>
    <td width="180"><b>polyrt</b></td>
    <td>Unified LLM runtime across MLX, Anthropic, and OpenAI. PyPI, v0.1.0.</td>
  </tr>
</table>

## Models on HuggingFace

Live download stats from the HuggingFace API, refreshed weekly.

<p align="center">
  <a href="https://huggingface.co/ramankrishna10/npc-fast-1.7b">
    <img src="./assets/hf-cards/npc-fast-1.7b.svg" alt="NPC Fast 1.7B" />
  </a>
  <a href="https://huggingface.co/ramankrishna10/npc-agentic-7b-v3">
    <img src="./assets/hf-cards/npc-agentic-7b-v3.svg" alt="NPC Agentic 7B v3" />
  </a>
</p>
<p align="center">
  <a href="https://huggingface.co/ramankrishna10/npc-fin-prm-7b">
    <img src="./assets/hf-cards/npc-fin-prm-7b.svg" alt="Fin-PRM 7B" />
  </a>
  <a href="https://huggingface.co/ramankrishna10/npc-fin-32b-sft">
    <img src="./assets/hf-cards/npc-fin-32b-sft.svg" alt="NPC Fin 32B" />
  </a>
</p>

<p align="center"><sub>Profile on <a href="https://huggingface.co/ramankrishna10">huggingface.co/ramankrishna10</a></sub></p>

## Published research

| Date | Title | Summary | Links |
|------|-------|---------|-------|
| 2026-04 | **NPC Fast 1.7B** | SmolLM2-1.7B-Instruct, full-weight CPT to 16K + router LoRA SFT. 98.3% OOD router accuracy, 77.8% IFEval. | [DOI](https://doi.org/10.5281/zenodo.19771040) · [HF](https://huggingface.co/ramankrishna10/npc-fast-1.7b) |
| 2026-04 | **NPC Fin 32B** | Qwen2.5-32B-Instruct, 12×H100 ZeRO-3, 32K SFT examples. CryptoQA 93.6%, GPTQ 4-bit 19.2GB. | [DOI](https://doi.org/10.5281/zenodo.19802598) · [HF](https://huggingface.co/ramankrishna10/npc-fin-32b-sft) |
| 2026-04 | **Fin-PRM 7B** | Qwen2.5-7B QLoRA process reward model, 4-dim. Spearman 0.9234, F1 0.8421, ECE 0.21. | [DOI](https://doi.org/10.5281/zenodo.19800784) · [HF](https://huggingface.co/ramankrishna10/npc-fin-prm-7b) |
| 2026-05 | **NPC Agentic 7B v3** | Qwen2.5-7B QLoRA + benchmark harness. BFCL v4 / IFEval / AgentBench under identical vLLM 0.6.3 GPTQ W4A16 serving. | [DOI](https://doi.org/10.5281/zenodo.19954103) · [HF](https://huggingface.co/ramankrishna10/npc-agentic-7b-v3) · [bench](https://github.com/ramankrishna/bench-npc-agentic-v3) |

<sub>All preprints CC-BY-4.0 · Bottensor Independent Research · ORCID <a href="https://orcid.org/0009-0000-1298-0681">0009-0000-1298-0681</a></sub>

## Open source

**Bottensor**

[![bottensor-models](https://img.shields.io/badge/bottensor--models-training_scripts-00dbb8?style=flat-square&labelColor=161b26)](https://github.com/ramankrishna/bottensor-models)
[![npc-mom-router](https://img.shields.io/pypi/v/npc-mom-router?style=flat-square&color=00dbb8&labelColor=161b26&label=npc-mom-router)](https://pypi.org/project/npc-mom-router/)
[![bottensor-fleet](https://img.shields.io/pypi/v/bottensor-fleet?style=flat-square&color=00dbb8&labelColor=161b26&label=bottensor-fleet)](https://pypi.org/project/bottensor-fleet/)
[![bench-npc-agentic-v3](https://img.shields.io/badge/bench--npc--agentic--v3-benchmark-f5c842?style=flat-square&labelColor=161b26)](https://github.com/ramankrishna/bench-npc-agentic-v3)

**@bottensor on npm**

[![cogito](https://img.shields.io/npm/v/@bottensor/cogito?style=flat-square&color=00dbb8&labelColor=161b26&label=%40bottensor%2Fcogito)](https://www.npmjs.com/package/@bottensor/cogito)
[![engram](https://img.shields.io/npm/v/@bottensor/engram?style=flat-square&color=00dbb8&labelColor=161b26&label=%40bottensor%2Fengram)](https://www.npmjs.com/package/@bottensor/engram)
[![forge](https://img.shields.io/npm/v/@bottensor/forge?style=flat-square&color=00dbb8&labelColor=161b26&label=%40bottensor%2Fforge)](https://www.npmjs.com/package/@bottensor/forge)

**Standalone**

[![polyRT](https://img.shields.io/pypi/v/polyrt?style=flat-square&color=00dbb8&labelColor=161b26&label=polyrt)](https://pypi.org/project/polyrt/)

## Experience

| Role | Where | What |
|------|-------|------|
| Software Engineer | **Lowe's**, Charlotte NC | Event-driven microservices, 1M+ Kafka events/day for promotions and payments. Postgres + Couchbase data sync. Grafana observability. 10M+ digital gift card batch processing. |
| Software Engineer | **Accenture**, Hyderabad | Data ingestion with Redis / Solr / Kafka — 140% query perf gain across 100M+ requests. AWS S3 + Avro pipelines. Fault-tolerant microservices serving 20M+ users. |

## Connect

<p align="left">
  <a href="https://huggingface.co/ramankrishna10"><img src="https://img.shields.io/badge/HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=000" /></a>
  <a href="https://www.linkedin.com/in/ramakrishna-bachu10/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=fff" /></a>
  <a href="https://bottensor.xyz"><img src="https://img.shields.io/badge/Bottensor-00DBB8?style=for-the-badge&labelColor=161b26" /></a>
  <a href="https://orcid.org/0009-0000-1298-0681"><img src="https://img.shields.io/badge/ORCID-A6CE39?style=for-the-badge&logo=orcid&logoColor=fff" /></a>
</p>

<p align="center"><sub><em>Independent research. Affiliations represent personal interests, not employer.</em></sub></p>
