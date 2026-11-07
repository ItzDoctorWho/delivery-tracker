# Real-Time Delivery Tracker

A real-time delivery platform built as a microservices architecture. The project explores service-to-service communication, event streaming, and multiple API styles in one system.

## Architecture

- Node.js services
- gRPC for internal communication
- GraphQL and REST APIs
- Apache Kafka in KRaft mode for event streaming

## Run locally

See the service-specific instructions in the repository. Each service can be installed and started independently with npm.

## Project goals

- Track delivery state changes in real time
- Separate responsibilities across independently deployable services
- Demonstrate practical integration of synchronous and event-driven communication