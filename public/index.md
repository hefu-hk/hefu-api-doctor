# HeFu API Doctor

> Verify your AI API before you run into issues.

HeFu API Doctor is a free open-source AI API compatibility checker and client configuration generator. It helps developers validate model IDs and protocol response structures before integrating an AI API.

## What it does

- Discovers model IDs from HeFu OAuth or a custom OpenAI-compatible endpoint.
- Checks OpenAI Chat Completions, OpenAI Responses and Anthropic Messages through HeFu OAuth.
- Checks Chat Completions and Responses on custom OpenAI-compatible endpoints, including keyless localhost servers such as Ollama.
- Generates starting configurations for Codex CLI, n8n, Claude Code, Cline, cURL, Python and Node.js.
- Provides no-request troubleshooting checklists for Codex and n8n configuration, authentication, rate-limit and client-only failures.
- Exports diagnostic reports without credentials, endpoint URLs, prompts or model outputs.

## How live checks work

Local setup preflight and configuration generation are free and do not contact a model endpoint. A live check sends one minimal, non-streaming text request with a 32-token output cap. It runs only after explicit user confirmation and may incur charges from the selected provider. API Doctor does not run batch tests or hidden retries.

## Privacy and limits

OAuth tokens and custom API keys stay in page memory. Reports contain only allowlisted status, timing, public model ID and safe guidance fields.

A successful check verifies only that one request returned a valid, non-empty response structure. It does not benchmark model quality, prove streaming or tool-calling support, validate multimodal behavior or replace production workload testing.

## 中文概述

合富宝 API Doctor 是免费开源的 AI API 兼容性诊断与客户端配置工具，帮助开发者在接入前验证模型 ID 和协议响应结构。支持合富宝 OAuth、OpenAI 兼容端点、本地 Ollama，以及 Codex CLI、n8n、Claude Code、Cline、cURL、Python 和 Node.js 配置生成。另提供 Codex 和 n8n 的免请求故障排查清单与双语专题指南。

工具、免费预检和配置生成不收取软件费用。真实检查必须经用户明确确认，每次只发送一个非流式最小请求，输出上限为 32 tokens，服务商可能收取模型费用。提示词、响应、凭据和端点 URL 不会写入导出报告。

一次通过只代表该请求的响应结构有效，不代表模型质量、流式、工具调用、多模态或生产负载均已通过验证。

## Resources

- [Open API Doctor](https://hefu.hk/api-doctor/)
- [Codex custom provider 404 checklist](https://hefu.hk/api-doctor/guides/codex-responses-404/) / [中文指南](https://hefu.hk/api-doctor/zh-cn/guides/codex-responses-404/)
- [n8n OpenAI-compatible model node 404 checklist](https://hefu.hk/api-doctor/guides/n8n-openai-compatible-404/) / [中文指南](https://hefu.hk/api-doctor/zh-cn/guides/n8n-openai-compatible-404/)
- [GitHub source and documentation](https://github.com/hefu-hk/hefu-api-doctor)
- [Gitee mirror](https://gitee.com/hefu-oss/hefu-api-doctor)
- [HeFu API documentation](https://hefu.hk/docs)
- [Validation record](https://github.com/hefu-hk/hefu-api-doctor/blob/main/docs/VALIDATION.md)
- [Apache-2.0 license](https://github.com/hefu-hk/hefu-api-doctor/blob/main/LICENSE)

Last updated: 2026-11-27.
