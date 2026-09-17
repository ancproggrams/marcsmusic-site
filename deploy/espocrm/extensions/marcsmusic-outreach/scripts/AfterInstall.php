<?php

declare(strict_types=1);

use Espo\Core\Container;
use Espo\Core\InjectableFactory;
use Espo\Core\Utils\Config;
use Espo\Core\Utils\Config\ConfigWriter;

final class AfterInstall
{
    /** @var list<string> */
    private const TABS = [
        'MusicRelease',
        'MediaOutlet',
        'MediaContact',
        'OutreachMatch',
        'OutreachEvent',
        'OutreachDailyReport',
        'OutreachSuppression',
    ];

    public function run(Container $container): void
    {
        $config = $container->getByClass(Config::class);
        $configWriter = $container
            ->getByClass(InjectableFactory::class)
            ->create(ConfigWriter::class);

        $configuredTabs = $config->get('tabList');
        $tabList = is_array($configuredTabs) ? $configuredTabs : [];

        foreach (self::TABS as $tab) {
            if (!in_array($tab, $tabList, true)) {
                $tabList[] = $tab;
            }
        }

        $configWriter->set('tabList', $tabList);
        $configWriter->save();
    }
}
