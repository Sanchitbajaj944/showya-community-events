import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface CommunitiesSectionProps {
  communities: any[];
}

export function CommunitiesSection({ communities }: CommunitiesSectionProps) {
  const { t } = useTranslation();

  return (
    <section id="communities" className="pt-4 sm:pt-6 md:pt-8 pb-12 sm:pb-16 md:pb-24 lg:pb-32 bg-muted/30">
      <div className="container px-4 md:px-6">
        <div className="max-w-3xl mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
            {t('home.communitiesYouLove')} <span className="text-gradient">{t('home.communitiesYouLoveGradient')}</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {communities.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              <p>{t('home.noCommunities')}</p>
            </div>
          ) : (
            communities.slice(0, 6).map((community, index) => (
              <Link 
                key={community.id} 
                to={`/community/${community.id}/public`}
                className={index >= 3 ? "hidden sm:block" : ""}
              >
                <Card className="group overflow-hidden hover:shadow-glow transition-all duration-300 cursor-pointer border-2 hover:border-primary/30 h-full flex flex-col">
                  {/* Banner Image */}
                  <div className="relative h-48 flex-shrink-0 overflow-hidden bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20">
                    {community.banner_url ? (
                      <img 
                        src={community.banner_url} 
                        alt={community.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="h-16 w-16 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  {/* Community Info */}
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-gradient transition-all">
                          {community.name}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {community.categories?.slice(0, 3).map((cat: string) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          {community.categories && community.categories.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{community.categories.length - 3}
                            </Badge>
                          )}
                        </div>
                        {community.owner && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {community.owner.profile_picture_url ? (
                                <img 
                                  src={community.owner.profile_picture_url} 
                                  alt={community.owner.display_name || community.owner.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Users className="h-3 w-3 text-primary" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              by {community.owner.display_name || community.owner.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {community.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {community.description}
                        </p>
                      )}
                    </div>

                    <Button className="w-full mt-4">
                      {t('home.viewCommunity')}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
        <div className="mt-10 sm:mt-12 md:mt-16 text-center">
          <Link to="/communities">
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
              {t('home.discoverMoreCommunities')}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
