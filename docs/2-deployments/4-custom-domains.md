---
title: Custom domains
---

# Custom domains

A common requirement for teams using Architect in production is the ability to bring their own domain name. By connecting a domain name to your environment, Architect can automatically configure the environment's API gateway to use the domain to power the environment's ingress rules.

All you have to do is tell your environment which DNS zone to use for the ingress rules, and Architect will take care of the rest. Just navigate to your environment, click on "Ingress" in the navigation bar, and the register your DNS zone in the form. Architect does NOT manage your DNS for you, so once registered you'll have to point the DNS zone to the gateway endpoint cited using a CNAME record.

![Custom DNS Zone](./images/custom-dns-zone.png)
